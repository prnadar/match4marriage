"""
Enquiries — public submission + admin inbox.

Public POST /api/v1/enquiries (no auth) — accepts contact-form / landing leads.
Admin GET /api/v1/admin/enquiries / PUT /api/v1/admin/enquiries/{id} — manage.
"""
from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user, has_admin_role
from app.core.tenancy import get_current_tenant_slug
from app.models.enquiry import Enquiry, EnquirySource, EnquiryStatus
from app.schemas.common import APIResponse, PaginatedResponse

router = APIRouter(tags=["enquiries"])
logger = get_logger(__name__)


def _require_admin(current_user: dict) -> None:
    if not has_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin required")


async def _tenant_uuid(db: AsyncSession, tenant_slug: str) -> uuid.UUID:
    from app.routers.profile import _resolve_tenant_uuid
    t = await _resolve_tenant_uuid(db, tenant_slug)
    if t is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return t


def _serialize(e: Enquiry) -> dict[str, Any]:
    return {
        "id": str(e.id),
        "source": e.source.value if e.source else None,
        "status": e.status.value if e.status else None,
        "name": e.name,
        "email": e.email,
        "phone": e.phone,
        "subject": e.subject,
        "message": e.message,
        "assigned_admin_id": str(e.assigned_admin_id) if e.assigned_admin_id else None,
        "admin_notes": e.admin_notes,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
        "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
    }


# ─── Public submission ───────────────────────────────────────────────────────


@router.post("/enquiries", response_model=APIResponse[dict])
async def public_create_enquiry(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Unauthenticated submission. Validate hard, never trust client metadata."""
    name = (payload.get("name") or "").strip()
    message = (payload.get("message") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    if len(name) > 120:
        raise HTTPException(status_code=400, detail="name must be ≤ 120 chars")
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    if len(message) > 5000:
        raise HTTPException(status_code=400, detail="message must be ≤ 5000 chars")

    email = (payload.get("email") or "").strip().lower() or None
    phone = (payload.get("phone") or "").strip() or None
    if not email and not phone:
        raise HTTPException(status_code=400, detail="email or phone is required")

    subject = (payload.get("subject") or "").strip() or None
    if subject and len(subject) > 200:
        subject = subject[:200]

    raw_source = (payload.get("source") or "contact_form").strip().lower()
    try:
        source = EnquirySource(raw_source)
    except ValueError:
        source = EnquirySource.OTHER

    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    e = Enquiry(
        tenant_id=tenant_uuid,
        source=source,
        status=EnquiryStatus.NEW,
        name=name[:120],
        email=email[:255] if email else None,
        phone=phone[:32] if phone else None,
        subject=subject,
        message=message,
    )
    db.add(e)
    await db.flush()
    await db.refresh(e)
    logger.info("public_enquiry_created", id=str(e.id), source=source.value, has_email=bool(email))
    # Public response intentionally narrow — we don't expose internal fields.
    return APIResponse(success=True, data={"id": str(e.id), "status": e.status.value})


# ─── Admin endpoints ─────────────────────────────────────────────────────────


ENQUIRIES_CSV_COLS = [
    "id", "source", "status", "name", "email", "phone", "subject", "message",
    "assigned_admin_id", "created_at", "resolved_at",
]


def _stream_csv(filename: str, cols: list[str], row_iter) -> StreamingResponse:
    def gen():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(cols)
        n = 0
        for r in row_iter:
            writer.writerow(r)
            n += 1
            if n % 100 == 0:
                yield buf.getvalue()
                buf.seek(0); buf.truncate(0)
        if buf.tell():
            yield buf.getvalue()
    return StreamingResponse(
        gen(), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _csv_row(d: dict[str, Any], cols: list[str]) -> list[str]:
    out: list[str] = []
    for c in cols:
        v = d.get(c)
        out.append("" if v is None else ("true" if v is True else "false" if v is False else str(v)))
    return out


@router.get("/admin/enquiries", response_model=PaginatedResponse[dict])
async def admin_list_enquiries(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    q: str | None = Query(default=None, description="Search by name, email, subject, message"),
    status_filter: str | None = Query(default=None, description="new | in_review | responded | closed"),
    source: str | None = Query(default=None, description="contact_form | landing | profile_interest | other"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    format: str | None = Query(default=None, description="json (default) | csv"),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)

    base = (
        select(Enquiry)
        .where(Enquiry.tenant_id == tenant_uuid)
        .where(Enquiry.deleted_at.is_(None))
    )
    if status_filter:
        try:
            base = base.where(Enquiry.status == EnquiryStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown status {status_filter!r}")
    if source:
        try:
            base = base.where(Enquiry.source == EnquirySource(source))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown source {source!r}")
    if q:
        ql = f"%{q.lower()}%"
        base = base.where(or_(
            func.lower(Enquiry.name).like(ql),
            func.lower(Enquiry.email).like(ql),
            func.lower(Enquiry.subject).like(ql),
            func.lower(Enquiry.message).like(ql),
        ))

    if (format or "").lower() == "csv":
        rows_csv = (await db.execute(
            base.order_by(Enquiry.created_at.desc())
        )).scalars().all()
        return _stream_csv(
            "enquiries.csv", ENQUIRIES_CSV_COLS,
            (_csv_row(_serialize(e), ENQUIRIES_CSV_COLS) for e in rows_csv),
        )

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (await db.execute(
        base.order_by(Enquiry.created_at.desc()).offset(offset).limit(limit)
    )).scalars().all()

    return PaginatedResponse.create(
        items=[_serialize(e) for e in rows],
        total=total, page=page, limit=limit,
    )


@router.get("/admin/enquiries/counts", response_model=APIResponse[dict])
async def admin_enquiry_counts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Per-status counts to power the inbox filter pills."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    rows = (await db.execute(
        select(Enquiry.status, func.count())
        .where(Enquiry.tenant_id == tenant_uuid, Enquiry.deleted_at.is_(None))
        .group_by(Enquiry.status)
    )).all()
    counts = {s.value: 0 for s in EnquiryStatus}
    for status, c in rows:
        counts[status.value] = int(c)
    counts["total"] = sum(counts.values())
    return APIResponse(success=True, data=counts)


@router.put("/admin/enquiries/{enquiry_id}", response_model=APIResponse[dict])
async def admin_update_enquiry(
    enquiry_id: uuid.UUID,
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Update status, assignment, notes. Only those three fields are mutable."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)

    e = (await db.execute(
        select(Enquiry).where(
            Enquiry.id == enquiry_id,
            Enquiry.tenant_id == tenant_uuid,
            Enquiry.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    if "status" in payload:
        try:
            new_status = EnquiryStatus((payload.get("status") or "").strip())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")
        e.status = new_status
        # Set resolved_at on terminal transitions; clear it if reopened.
        if new_status in (EnquiryStatus.RESPONDED, EnquiryStatus.CLOSED):
            e.resolved_at = datetime.now(timezone.utc)
        else:
            e.resolved_at = None

    if "admin_notes" in payload:
        notes = payload.get("admin_notes")
        e.admin_notes = (notes or None) if notes is None or isinstance(notes, str) else None

    if "assign_to_me" in payload and payload.get("assign_to_me"):
        try:
            e.assigned_admin_id = uuid.UUID(current_user.get("sub", ""))
        except (ValueError, AttributeError):
            pass
    elif "assigned_admin_id" in payload:
        v = payload.get("assigned_admin_id")
        if v is None:
            e.assigned_admin_id = None
        else:
            try:
                e.assigned_admin_id = uuid.UUID(str(v))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Invalid assigned_admin_id")

    await db.flush()
    await db.refresh(e)
    logger.info("admin_update_enquiry", id=str(enquiry_id), status=e.status.value, by=current_user.get("sub"))
    return APIResponse(success=True, data=_serialize(e))


@router.delete("/admin/enquiries/{enquiry_id}", response_model=APIResponse[dict])
async def admin_delete_enquiry(
    enquiry_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Soft-delete (sets deleted_at)."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    e = (await db.execute(
        select(Enquiry).where(
            Enquiry.id == enquiry_id,
            Enquiry.tenant_id == tenant_uuid,
            Enquiry.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    e.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    logger.info("admin_delete_enquiry", id=str(enquiry_id), by=current_user.get("sub"))
    return APIResponse(success=True, data={"id": str(enquiry_id)})
