"""
Admin router — user management, stats, admin-only ops endpoints.

All endpoints require the caller's Firebase ID token to carry an `admin`
(or `super_admin`) custom claim. Tenant isolation is enforced on every query.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any

import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession
from firebase_admin import auth as firebase_auth

from app.core.database import get_db
from app.core.firebase import get_firebase_app
from app.core.logging import get_logger
from app.core.security import get_current_user, has_admin_role, _roles_from_claims
from app.core.tenancy import get_current_tenant_slug
from app.models.report import Report, ReportStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import SubscriptionTier, User, UserProfile
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.user import ProfileRead
from app.models.admin_crm import AdminCommunication, UserCrmProfile
from app.services.crm import extract_contact, plan_label
from app.services.audit import record_admin_action

router = APIRouter(prefix="/admin", tags=["admin"])
logger = get_logger(__name__)


def _require_admin(current_user: dict) -> None:
    if not has_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin required")


@router.get("/debug/sentry-test")
async def debug_sentry_test(current_user: dict = Depends(get_current_user)):
    """Admin-only: deliberately raise so you can confirm Sentry captures backend
    errors. It only 500s for an admin who calls it, so it's safe to leave in
    place — or ask me to remove it once you've verified the connection."""
    _require_admin(current_user)
    raise RuntimeError(
        "Sentry backend test error — intentionally raised from "
        "/api/v1/admin/debug/sentry-test; safe to ignore."
    )


async def _tenant_uuid_from_slug(db: AsyncSession, tenant_slug: str) -> uuid.UUID:
    from app.routers.profile import _resolve_tenant_uuid
    t = await _resolve_tenant_uuid(db, tenant_slug)
    if t is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return t


# ─── Users ───────────────────────────────────────────────────────────────────


def _serialize_user(u: User, p: UserProfile | None) -> dict[str, Any]:
    photos = (p.photos if p else None) or []
    primary = next((ph.get("url") for ph in photos if ph.get("is_primary")), None)
    if primary is None and photos:
        primary = photos[0].get("url")
    return {
        "id": str(u.id),
        "membership_number": u.membership_number,
        "email": u.email,
        "phone": u.phone,
        "is_active": bool(u.is_active),
        "is_phone_verified": bool(u.is_phone_verified),
        "is_email_verified": bool(u.is_email_verified),
        "is_profile_complete": bool(u.is_profile_complete),
        "subscription_tier": u.subscription_tier.value if u.subscription_tier else "free",
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_active_at": u.last_active_at.isoformat() if u.last_active_at else None,
        "deleted_at": u.deleted_at.isoformat() if u.deleted_at else None,
        # Flattened from profile
        "first_name": p.first_name if p else "",
        "last_name": p.last_name if p else "",
        "city": p.city if p else None,
        "country": (p.country if p else None),
        "religion": p.religion.value if (p and p.religion) else None,
        "occupation": p.occupation if p else None,
        "primary_photo_url": primary,
        "completeness_score": int(p.completeness_score) if p and p.completeness_score is not None else 0,
        "verification_status": p.verification_status if p else "draft",
        # CRM: contact details normalised for one-click call / WhatsApp / email
        # (phone_e164, phone_country_code, whatsapp_number, preferred_contact…).
        "gender": p.gender.value if (p and p.gender) else None,
        "plan_label": plan_label(u.subscription_tier.value if u.subscription_tier else None),
        **extract_contact(u, p),
    }


def _serialize_user_crm(u: User, p: UserProfile | None, crm: UserCrmProfile | None) -> dict[str, Any]:
    d = _serialize_user(u, p)
    d["tags"] = list(crm.tags or []) if crm and crm.deleted_at is None else []
    d["follow_up_at"] = crm.follow_up_at.isoformat() if crm and crm.deleted_at is None and crm.follow_up_at else None
    d["follow_up_note"] = crm.follow_up_note if crm and crm.deleted_at is None else None
    return d


USER_CSV_COLS = [
    "id", "membership_number", "first_name", "last_name", "gender",
    # Contact
    "email", "is_email_verified", "phone_e164", "phone_country_code", "is_phone_verified",
    "whatsapp_number", "preferred_contact", "best_time_to_call", "alt_phone",
    "contact_person_name", "contact_relationship", "address",
    # Profile / account
    "city", "country", "religion", "occupation", "subscription_tier", "plan_label",
    "verification_status", "completeness_score", "is_active",
    "created_at", "last_active_at",
    # CRM
    "tags", "follow_up_at", "follow_up_note",
]


@router.get("/users", response_model=PaginatedResponse[dict])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    q: str | None = Query(default=None, description="Search on name, email, phone"),
    status_filter: str | None = Query(default=None, description="active | suspended | deleted | verified | pending"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    format: str | None = Query(default=None, description="json (default) | csv"),
    tag: str | None = Query(default=None, max_length=40, description="CRM tag, e.g. VIP"),
    follow_up: str | None = Query(default=None, description="due | upcoming | any"),
    plan: str | None = Query(default=None, description="free | silver | gold | platinum"),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)

    base = (
        select(User, UserProfile, UserCrmProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .outerjoin(UserCrmProfile, (UserCrmProfile.user_id == User.id) & (UserCrmProfile.tenant_id == tenant_uuid))
        .where(User.tenant_id == tenant_uuid)
    )

    # CRM filters
    if tag:
        from sqlalchemy import cast as _cast
        from sqlalchemy.dialects.postgresql import JSONB as _JSONB
        base = base.where(UserCrmProfile.deleted_at.is_(None), _cast(UserCrmProfile.tags, _JSONB).contains([tag.strip()]))
    if follow_up in ("due", "upcoming", "any"):
        base = base.where(UserCrmProfile.deleted_at.is_(None), UserCrmProfile.follow_up_at.is_not(None))
        if follow_up == "due":
            base = base.where(UserCrmProfile.follow_up_at <= date.today())
        elif follow_up == "upcoming":
            base = base.where(UserCrmProfile.follow_up_at > date.today())
    if plan:
        try:
            base = base.where(User.subscription_tier == SubscriptionTier(plan.lower()))
        except ValueError:
            raise HTTPException(status_code=400, detail="plan must be one of free, silver, gold, platinum")

    # Filters
    if status_filter == "active":
        base = base.where(User.deleted_at.is_(None), User.is_active == True)  # noqa: E712
    elif status_filter == "suspended":
        base = base.where(User.deleted_at.is_(None), User.is_active == False)  # noqa: E712
    elif status_filter == "deleted":
        base = base.where(User.deleted_at.is_not(None))
    elif status_filter == "verified":
        base = base.where(UserProfile.verification_status == "approved", User.deleted_at.is_(None))
    elif status_filter == "pending":
        base = base.where(UserProfile.verification_status == "submitted", User.deleted_at.is_(None))
    else:
        base = base.where(User.deleted_at.is_(None))

    if q:
        ql = f"%{q.lower()}%"
        # Membership numbers are upper-case but we match case-insensitively
        # so admins can type "m4m-2026-1" or paste verbatim from email.
        qu = f"%{q.upper()}%"
        base = base.where(or_(
            func.lower(User.email).like(ql),
            User.phone.like(f"%{q}%"),
            User.membership_number.like(qu),
            func.lower(UserProfile.first_name).like(ql),
            func.lower(UserProfile.last_name).like(ql),
        ))

    # CSV streams the *filtered* set, ignoring page/limit, with a hard cap
    # to keep an unbounded export from OOMing the worker.
    if (format or "").lower() == "csv":
        rows = (await db.execute(base.order_by(User.created_at.desc()).limit(50_000))).all()
        # A bulk export of contact details is always worth an audit row.
        await record_admin_action(
            db, current_user, "access.export_members", tenant_id=tenant_uuid,
            target_type="export", target_label="users.csv",
            details={"rows": len(rows), "q": q, "status_filter": status_filter, "tag": tag, "plan": plan},
        )
        return _stream_csv(
            filename="users.csv",
            cols=USER_CSV_COLS,
            row_iter=(_csv_row(_serialize_user_crm(u, p, crm), USER_CSV_COLS) for u, p, crm in rows),
        )

    total: int = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    offset = (page - 1) * limit
    rows = (await db.execute(
        base.order_by(User.created_at.desc()).offset(offset).limit(limit)
    )).all()

    items = [_serialize_user_crm(u, p, crm) for u, p, crm in rows]

    # Last admin contact per row (one grouped query for the page).
    if items:
        page_ids = [u.id for u, _, _ in rows]
        last_rows = (await db.execute(
            select(AdminCommunication.user_id, func.max(AdminCommunication.created_at))
            .where(
                AdminCommunication.tenant_id == tenant_uuid,
                AdminCommunication.user_id.in_(page_ids),
                AdminCommunication.deleted_at.is_(None),
                AdminCommunication.status.in_(["sent", "logged"]),
            )
            .group_by(AdminCommunication.user_id)
        )).all()
        last_map = {str(uid): ts.isoformat() if ts else None for uid, ts in last_rows}
        for it in items:
            it["last_contacted_at"] = last_map.get(it["id"])

    return PaginatedResponse.create(items=items, total=total, page=page, limit=limit)


# ─── CSV helpers ─────────────────────────────────────────────────────────────


def _csv_row(d: dict[str, Any], cols: list[str]) -> list[str]:
    """Coerce a serialized dict row into CSV-friendly strings."""
    out: list[str] = []
    for c in cols:
        v = d.get(c)
        if v is None:
            out.append("")
        elif isinstance(v, bool):
            out.append("true" if v else "false")
        elif isinstance(v, (list, tuple)):
            out.append("; ".join(str(x) for x in v))
        else:
            out.append(str(v))
    return out


def _stream_csv(filename: str, cols: list[str], row_iter) -> StreamingResponse:
    """Stream CSV in 100-row chunks so very large exports don't buffer in RAM."""
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
        gen(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── Bulk actions ────────────────────────────────────────────────────────────


@router.post("/users/bulk", response_model=APIResponse[dict])
async def bulk_user_action(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Apply one of {suspend|activate} to a list of user_ids. Tenant-scoped."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)

    action = (payload.get("action") or "").strip().lower()
    if action not in ("suspend", "activate"):
        raise HTTPException(status_code=400, detail="action must be 'suspend' or 'activate'")

    raw_ids = payload.get("user_ids") or []
    if not isinstance(raw_ids, list) or not raw_ids:
        raise HTTPException(status_code=400, detail="user_ids must be a non-empty list")
    if len(raw_ids) > 500:
        raise HTTPException(status_code=400, detail="bulk operations are capped at 500 users")

    ids: list[uuid.UUID] = []
    for raw in raw_ids:
        try:
            ids.append(uuid.UUID(str(raw)))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"invalid user_id {raw!r}")

    rows = (await db.execute(
        select(User).where(
            User.id.in_(ids),
            User.tenant_id == tenant_uuid,
            User.deleted_at.is_(None),
        )
    )).scalars().all()

    new_active = (action == "activate")
    affected = 0
    for u in rows:
        if u.is_active != new_active:
            u.is_active = new_active
            affected += 1

    await db.flush()

    # Suspend revokes Firebase sessions so logged-in users drop immediately.
    if action == "suspend":
        try:
            app = get_firebase_app()
            for u in rows:
                if not u.is_active and u.firebase_uids:
                    for fuid in u.firebase_uids:
                        try:
                            firebase_auth.revoke_refresh_tokens(fuid, app=app)
                        except Exception as exc:
                            logger.warning("bulk_revoke_failed", uid=fuid, error=str(exc))
        except Exception as exc:
            logger.warning("bulk_firebase_revoke_skipped", error=str(exc))

    logger.info("admin_bulk_user_action", admin=current_user.get("sub"), action=action, requested=len(ids), affected=affected)
    await record_admin_action(db, current_user, f"user.bulk_{action}", tenant_id=tenant_uuid, target_type="user", summary=f"Bulk {action}: {affected} of {len(ids)} member(s)", details={"user_ids": [str(i) for i in ids][:50], "affected": affected})
    return APIResponse(success=True, data={
        "action": action,
        "requested": len(ids),
        "matched": len(rows),
        "affected": affected,
    })


@router.get("/users/{user_id}", response_model=APIResponse[dict])
async def get_user_detail(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)

    row = (await db.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.id == user_id, User.tenant_id == tenant_uuid)
    )).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    u, p = row

    # Audit of views: this response carries the member's contact details.
    # Throttled (one row per admin/member per 15 min) and never raises.
    from app.services.view_audit import record_member_view
    await record_member_view(
        db, current_user, "contact", tenant_id=tenant_uuid, user_id=u.id,
        label=u.email or u.membership_number, surface="member_page",
    )

    base = _serialize_user(u, p)
    profile = ProfileRead.model_validate(p, from_attributes=True).model_dump(mode="json") if p else None

    # Counts of related items
    reports_against = (await db.execute(
        select(func.count()).where(Report.reported_user_id == user_id, Report.deleted_at.is_(None))
    )).scalar_one()
    reports_filed = (await db.execute(
        select(func.count()).where(Report.reporter_id == user_id, Report.deleted_at.is_(None))
    )).scalar_one()

    # CRM: tags + follow-up, current subscription, last admin contact.
    crm = (await db.execute(
        select(UserCrmProfile).where(
            UserCrmProfile.tenant_id == tenant_uuid,
            UserCrmProfile.user_id == user_id,
            UserCrmProfile.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    sub = (await db.execute(
        select(Subscription).where(
            Subscription.tenant_id == tenant_uuid,
            Subscription.user_id == user_id,
            Subscription.deleted_at.is_(None),
        ).order_by(Subscription.current_period_end.desc()).limit(1)
    )).scalar_one_or_none()
    last_contacted = (await db.execute(
        select(func.max(AdminCommunication.created_at)).where(
            AdminCommunication.tenant_id == tenant_uuid,
            AdminCommunication.user_id == user_id,
            AdminCommunication.deleted_at.is_(None),
            AdminCommunication.status.in_(["sent", "logged"]),
        )
    )).scalar_one_or_none()
    crm_fields = {
        "tags": list(crm.tags or []) if crm else [],
        "follow_up_at": crm.follow_up_at.isoformat() if crm and crm.follow_up_at else None,
        "follow_up_note": crm.follow_up_note if crm else None,
        "last_contacted_at": last_contacted.isoformat() if last_contacted else None,
        "subscription": {
            "plan": sub.plan,
            "plan_label": plan_label(sub.plan),
            "status": sub.status.value if sub.status else None,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "amount_pence": sub.amount_paise,
            "currency": sub.currency,
        } if sub else None,
    }

    return APIResponse(success=True, data={**base, **crm_fields, "profile": profile, "reports_against": reports_against, "reports_filed": reports_filed})


async def _load_user_for_admin(db: AsyncSession, user_id: uuid.UUID, tenant_uuid: uuid.UUID) -> User:
    u = (await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant_uuid)
    )).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return u


@router.post("/users/{user_id}/suspend", response_model=APIResponse[dict])
async def suspend_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)
    u = await _load_user_for_admin(db, user_id, tenant_uuid)
    u.is_active = False
    await db.flush()
    # Also revoke Firebase refresh tokens so active sessions die immediately.
    try:
        if u.firebase_uids:
            app = get_firebase_app()
            for fuid in u.firebase_uids:
                try:
                    firebase_auth.revoke_refresh_tokens(fuid, app=app)
                except Exception as exc:
                    logger.warning("revoke_tokens_failed", uid=fuid, error=str(exc))
    except Exception as exc:
        logger.warning("firebase_revoke_skipped", error=str(exc))
    logger.info("admin_suspend_user", admin=current_user.get("sub"), target=str(user_id))
    await record_admin_action(db, current_user, "user.suspend", tenant_id=tenant_uuid, target_type="user", target_id=user_id, target_label=u.email or u.membership_number)
    return APIResponse(success=True, data={"id": str(u.id), "is_active": u.is_active})


@router.post("/users/{user_id}/activate", response_model=APIResponse[dict])
async def activate_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)
    u = await _load_user_for_admin(db, user_id, tenant_uuid)
    u.is_active = True
    await db.flush()
    logger.info("admin_activate_user", admin=current_user.get("sub"), target=str(user_id))
    await record_admin_action(db, current_user, "user.activate", tenant_id=tenant_uuid, target_type="user", target_id=user_id, target_label=u.email or u.membership_number)
    return APIResponse(success=True, data={"id": str(u.id), "is_active": u.is_active})


@router.post("/users/{user_id}/soft-delete", response_model=APIResponse[dict])
async def soft_delete_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)
    u = await _load_user_for_admin(db, user_id, tenant_uuid)
    u.deleted_at = datetime.now(timezone.utc)
    u.is_active = False
    # Soft-delete their profile too so they drop out of browse
    prof = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )).scalar_one_or_none()
    if prof and prof.deleted_at is None:
        prof.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    try:
        if u.firebase_uids:
            app = get_firebase_app()
            for fuid in u.firebase_uids:
                try:
                    firebase_auth.revoke_refresh_tokens(fuid, app=app)
                except Exception:
                    pass
    except Exception:
        pass
    logger.info("admin_soft_delete_user", admin=current_user.get("sub"), target=str(user_id))
    await record_admin_action(db, current_user, "user.delete", tenant_id=tenant_uuid, target_type="user", target_id=user_id, target_label=u.email or u.membership_number)
    return APIResponse(success=True, data={"id": str(u.id)})


@router.post("/users/{user_id}/restore", response_model=APIResponse[dict])
async def restore_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)
    u = (await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant_uuid)
    )).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    # An account the MEMBER deleted (POST /auth/delete-account) has had its
    # Firebase sign-in removed and its email/phone moved into the
    # account_settings.deletion tombstone. Flipping deleted_at back would leave
    # a contactless record nobody can sign in to — and overrides an erasure
    # request. Only staff soft-deletes are restorable here.
    from app.routers.auth import _read_account_settings
    _deletion = (await _read_account_settings(db, u.id)).get("deletion")
    if u.deleted_at is not None and isinstance(_deletion, dict) and (_deletion.get("by") or "self") == "self":
        raise HTTPException(
            status_code=409,
            detail="This member deleted their own account, so it can't be restored — their sign-in and contact details were removed. They would need to register again.",
        )
    u.deleted_at = None
    u.is_active = True
    prof = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )).scalar_one_or_none()
    if prof and prof.deleted_at is not None:
        prof.deleted_at = None
    await db.flush()
    logger.info("admin_restore_user", admin=current_user.get("sub"), target=str(user_id))
    await record_admin_action(db, current_user, "user.restore", tenant_id=tenant_uuid, target_type="user", target_id=user_id, target_label=u.email or u.membership_number)
    return APIResponse(success=True, data={"id": str(u.id)})


# ─── Stats / Dashboard ───────────────────────────────────────────────────────


@router.get("/stats", response_model=APIResponse[dict])
async def dashboard_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Top-line KPIs for the admin dashboard."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)

    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    async def _count(q) -> int:
        return (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()

    users_q = select(User.id).where(User.tenant_id == tenant_uuid, User.deleted_at.is_(None))
    active_users_q = users_q.where(User.is_active == True)  # noqa: E712
    suspended_users_q = select(User.id).where(
        User.tenant_id == tenant_uuid, User.deleted_at.is_(None), User.is_active == False  # noqa: E712
    )
    new_today_q = users_q.where(User.created_at >= today_start)
    new_7d_q = users_q.where(User.created_at >= seven_days_ago)
    new_30d_q = users_q.where(User.created_at >= thirty_days_ago)

    profiles_base = select(UserProfile.id).where(UserProfile.tenant_id == tenant_uuid, UserProfile.deleted_at.is_(None))
    pending_q = profiles_base.where(UserProfile.verification_status == "submitted")
    approved_q = profiles_base.where(UserProfile.verification_status == "approved")
    rejected_q = profiles_base.where(UserProfile.verification_status == "rejected")

    reports_open_q = select(Report.id).where(
        Report.deleted_at.is_(None), Report.status == ReportStatus.OPEN
    )

    total_users = await _count(users_q)
    active_users = await _count(active_users_q)
    suspended_users = await _count(suspended_users_q)
    new_today = await _count(new_today_q)
    new_7d = await _count(new_7d_q)
    new_30d = await _count(new_30d_q)
    pending = await _count(pending_q)
    approved = await _count(approved_q)
    rejected = await _count(rejected_q)
    open_reports = await _count(reports_open_q)

    # Registration trend (last 90 days, bucketed by day). `registration_trend`
    # keeps its historical 14-day window; the dashboard charts the 90-day one.
    trend_rows = (await db.execute(sa_text("""
        SELECT DATE(created_at AT TIME ZONE 'UTC') AS d, COUNT(*) AS c
        FROM users
        WHERE tenant_id = :tid AND deleted_at IS NULL
          AND created_at >= NOW() - INTERVAL '90 days'
        GROUP BY d
        ORDER BY d
    """), {"tid": str(tenant_uuid)})).all()
    trend_90d = [{"date": r[0].isoformat(), "count": int(r[1])} for r in trend_rows]
    _cut14 = (now - timedelta(days=14)).date().isoformat()
    trend = [t for t in trend_90d if t["date"] >= _cut14]

    # ── Extended console metrics (one round-trip for all scalar counts) ──
    # Isolated in a savepoint: a failure here must never take down the core
    # stats the notification bell and dashboard rely on.
    ext: dict[str, Any] = {}
    try:
        async with db.begin_nested():
            ext = await _dashboard_extended(db, tenant_uuid, now)
    except Exception as exc:
        logger.warning("dashboard_extended_failed", error=str(exc))

    # Religion distribution
    relig_rows = (await db.execute(sa_text("""
        SELECT religion::text AS r, COUNT(*) AS c
        FROM profiles
        WHERE tenant_id = :tid AND deleted_at IS NULL AND religion IS NOT NULL
        GROUP BY religion
        ORDER BY c DESC
        LIMIT 10
    """), {"tid": str(tenant_uuid)})).all()
    religion = [{"religion": r[0], "count": int(r[1])} for r in relig_rows]

    # Recent activity (last 20 submissions / approvals / rejections)
    recent_rows = (await db.execute(sa_text("""
        SELECT p.user_id, p.first_name, p.last_name,
               p.verification_status, p.submitted_at, p.reviewed_at
        FROM profiles p
        WHERE p.tenant_id = :tid AND p.deleted_at IS NULL
          AND (p.submitted_at IS NOT NULL OR p.reviewed_at IS NOT NULL)
        ORDER BY GREATEST(
            COALESCE(p.reviewed_at, 'epoch'::timestamp),
            COALESCE(p.submitted_at, 'epoch'::timestamp)
        ) DESC
        LIMIT 20
    """), {"tid": str(tenant_uuid)})).all()
    recent = [
        {
            "user_id": str(r[0]),
            "name": f"{(r[1] or '').strip()} {(r[2] or '').strip()}".strip() or "(unnamed)",
            "status": r[3],
            "submitted_at": r[4].isoformat() if r[4] else None,
            "reviewed_at": r[5].isoformat() if r[5] else None,
        }
        for r in recent_rows
    ]

    # Earnings — sums over `subscriptions.amount_paise` for non-cancelled rows.
    # `total` covers all-time gross. `this_month` covers subscriptions whose
    # current_period_start is in the current calendar month (proxy for new
    # billings this month). `monthly_series` is the last 12 months bucketed
    # by current_period_start month.
    #
    # subscriptions.current_period_start is TIMESTAMP WITHOUT TIME ZONE, so
    # parameters MUST be naive (no tzinfo). NOW() in SQL is naive too.
    month_start_naive = datetime(now.year, now.month, 1)

    earnings_total_row = (await db.execute(sa_text("""
        SELECT COALESCE(SUM(amount_paise), 0)
        FROM subscriptions
        WHERE tenant_id = :tid
          AND UPPER(status::text) IN ('ACTIVE', 'PAST_DUE', 'EXPIRED', 'PAUSED')
    """), {"tid": str(tenant_uuid)})).scalar_one()

    earnings_month_row = (await db.execute(sa_text("""
        SELECT COALESCE(SUM(amount_paise), 0)
        FROM subscriptions
        WHERE tenant_id = :tid
          AND UPPER(status::text) IN ('ACTIVE', 'PAST_DUE', 'EXPIRED', 'PAUSED')
          AND current_period_start >= :month_start
    """), {"tid": str(tenant_uuid), "month_start": month_start_naive})).scalar_one()

    earnings_series_rows = (await db.execute(sa_text("""
        SELECT TO_CHAR(date_trunc('month', current_period_start), 'YYYY-MM') AS m,
               COALESCE(SUM(amount_paise), 0) AS p
        FROM subscriptions
        WHERE tenant_id = :tid
          AND UPPER(status::text) IN ('ACTIVE', 'PAST_DUE', 'EXPIRED', 'PAUSED')
          AND current_period_start >= NOW() - INTERVAL '12 months'
        GROUP BY m
        ORDER BY m
    """), {"tid": str(tenant_uuid)})).all()
    earnings_series = [{"month": r[0], "paise": int(r[1])} for r in earnings_series_rows]

    # Plan distribution — count of (non-deleted) users per subscription_tier.
    # Postgres stores the enum by Python *name* (uppercase), but the frontend
    # PLAN_META lookup keys are the enum *values* (lowercase). Normalise the
    # DB result to lowercase before counting so we don't end up with both
    # 'FREE' and 'free' as separate rows.
    plan_rows = (await db.execute(sa_text("""
        SELECT LOWER(subscription_tier::text) AS t, COUNT(*) AS c
        FROM users
        WHERE tenant_id = :tid AND deleted_at IS NULL
        GROUP BY LOWER(subscription_tier::text)
    """), {"tid": str(tenant_uuid)})).all()
    # Always present all four tiers, even at 0, so the dashboard renders cleanly.
    plan_counts = {t.value: 0 for t in SubscriptionTier}
    for r in plan_rows:
        key = r[0]
        if key in plan_counts:
            plan_counts[key] = int(r[1])
    plan_distribution = [{"plan": k, "count": v} for k, v in plan_counts.items()]

    # Renewals due — active subscriptions whose period ends in the next 14 days.
    # current_period_end is TIMESTAMP WITHOUT TIME ZONE; pass naive datetime.
    in_14_days_naive = (now + timedelta(days=14)).replace(tzinfo=None)
    renewals_rows = (await db.execute(sa_text("""
        SELECT s.user_id, s.plan, s.amount_paise, s.current_period_end,
               p.first_name, p.last_name
        FROM subscriptions s
        LEFT JOIN profiles p ON p.user_id = s.user_id
        WHERE s.tenant_id = :tid
          AND UPPER(s.status::text) = 'ACTIVE'
          AND s.current_period_end >= NOW()
          AND s.current_period_end <= :until
        ORDER BY s.current_period_end ASC
        LIMIT 10
    """), {"tid": str(tenant_uuid), "until": in_14_days_naive})).all()
    renewals_due = [
        {
            "user_id": str(r[0]),
            "plan": r[1],
            "amount_paise": int(r[2]),
            "current_period_end": r[3].isoformat() if r[3] else None,
            "name": f"{(r[4] or '').strip()} {(r[5] or '').strip()}".strip() or "(unnamed)",
        }
        for r in renewals_rows
    ]

    return APIResponse(success=True, data={
        "users": {
            "total": total_users,
            "active": active_users,
            "suspended": suspended_users,
            "new_today": new_today,
            "new_7d": new_7d,
            "new_30d": new_30d,
        },
        "profiles": {
            "pending": pending,
            "approved": approved,
            "rejected": rejected,
        },
        "reports": {
            "open": open_reports,
        },
        "earnings": {
            "total_paise": int(earnings_total_row),
            "this_month_paise": int(earnings_month_row),
            "monthly_series": earnings_series,
        },
        "plan_distribution": plan_distribution,
        "renewals_due": renewals_due,
        "registration_trend": trend,
        "registration_trend_90d": trend_90d,
        "religion_distribution": religion,
        "recent_activity": recent,
        **ext,
    })


async def _dashboard_extended(db: AsyncSession, tenant_uuid: uuid.UUID, now: datetime) -> dict[str, Any]:
    """Period-over-period deltas, funnel, engagement, breakdowns and the
    needs-attention queue for the admin dashboard. Additive to /admin/stats."""
    tid = str(tenant_uuid)
    month_start = datetime(now.year, now.month, 1)
    prev_month_start = datetime(now.year - 1, 12, 1) if now.month == 1 else datetime(now.year, now.month - 1, 1)

    s = (await db.execute(sa_text("""
        SELECT
          (SELECT COUNT(*) FROM users WHERE tenant_id = :tid AND deleted_at IS NULL
             AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'),
          (SELECT COUNT(*) FROM users WHERE tenant_id = :tid AND deleted_at IS NULL
             AND created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'),
          (SELECT COUNT(*) FROM users WHERE tenant_id = :tid AND deleted_at IS NULL AND is_profile_complete),
          (SELECT COUNT(*) FROM profiles WHERE tenant_id = :tid AND deleted_at IS NULL
             AND (submitted_at IS NOT NULL OR verification_status IN ('submitted','approved','rejected'))),
          (SELECT COUNT(DISTINCT user_id) FROM subscriptions WHERE tenant_id = :tid
             AND UPPER(status::text) = 'ACTIVE' AND current_period_end >= NOW()),
          (SELECT COUNT(*) FROM interests WHERE tenant_id = :tid AND deleted_at IS NULL
             AND created_at >= NOW() - INTERVAL '30 days'),
          (SELECT COUNT(*) FROM interests WHERE tenant_id = :tid AND deleted_at IS NULL
             AND created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'),
          (SELECT COUNT(*) FROM matches WHERE tenant_id = :tid AND deleted_at IS NULL
             AND UPPER(status::text) = 'MUTUAL'),
          (SELECT COUNT(*) FROM matches WHERE tenant_id = :tid AND deleted_at IS NULL
             AND UPPER(status::text) = 'MUTUAL' AND updated_at >= NOW() - INTERVAL '30 days'),
          (SELECT COUNT(*) FROM messages WHERE tenant_id = :tid AND deleted_at IS NULL
             AND created_at >= NOW() - INTERVAL '30 days'),
          (SELECT COUNT(*) FROM messages WHERE tenant_id = :tid AND deleted_at IS NULL
             AND created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'),
          (SELECT COALESCE(SUM(amount_paise), 0) FROM subscriptions WHERE tenant_id = :tid
             AND UPPER(status::text) IN ('ACTIVE', 'PAST_DUE', 'EXPIRED', 'PAUSED')
             AND current_period_start >= :prev_month_start AND current_period_start < :month_start),
          (SELECT COUNT(*) FROM enquiries WHERE tenant_id = :tid AND deleted_at IS NULL
             AND UPPER(status::text) = 'NEW'),
          (SELECT AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at))) / 3600.0 FROM profiles
             WHERE tenant_id = :tid AND deleted_at IS NULL AND submitted_at IS NOT NULL
             AND reviewed_at IS NOT NULL AND reviewed_at >= submitted_at
             AND verification_status IN ('approved','rejected')
             AND reviewed_at >= NOW() - INTERVAL '30 days')
    """), {"tid": tid, "month_start": month_start, "prev_month_start": prev_month_start})).one()
    (new_prev_7d, new_prev_30d, profile_complete, submitted_ever, paid_members,
     interests_30d, interests_prev_30d, mutual_total, mutual_30d, messages_30d,
     messages_prev_30d, revenue_prev_month, new_enquiries, avg_review_hours) = s

    sub_rows = (await db.execute(sa_text("""
        SELECT LOWER(plan) AS p, COUNT(*) AS c, COALESCE(SUM(amount_paise), 0) AS amt
        FROM subscriptions
        WHERE tenant_id = :tid AND UPPER(status::text) = 'ACTIVE' AND current_period_end >= NOW()
        GROUP BY LOWER(plan)
    """), {"tid": tid})).all()
    active_by_plan = {k: {"count": 0, "amount_paise": 0} for k in ("silver", "gold", "platinum")}
    for p, c, amt in sub_rows:
        active_by_plan.setdefault(p, {"count": 0, "amount_paise": 0})
        active_by_plan[p] = {"count": int(c), "amount_paise": int(amt)}

    gender_rows = (await db.execute(sa_text("""
        SELECT LOWER(COALESCE(gender::text, 'unknown')) AS g, COUNT(*) FROM profiles
        WHERE tenant_id = :tid AND deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC
    """), {"tid": tid})).all()
    country_rows = (await db.execute(sa_text("""
        SELECT COALESCE(NULLIF(TRIM(country), ''), 'Unknown') AS c, COUNT(*) FROM profiles
        WHERE tenant_id = :tid AND deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8
    """), {"tid": tid})).all()

    waiting_rows = (await db.execute(sa_text("""
        SELECT user_id, first_name, last_name, submitted_at, completeness_score
        FROM profiles
        WHERE tenant_id = :tid AND deleted_at IS NULL AND verification_status = 'submitted'
        ORDER BY submitted_at ASC NULLS LAST
        LIMIT 6
    """), {"tid": tid})).all()
    now_naive = now.replace(tzinfo=None)
    oldest_pending = [
        {
            "user_id": str(r[0]),
            "name": f"{(r[1] or '').strip()} {(r[2] or '').strip()}".strip() or "(unnamed)",
            "submitted_at": r[3].isoformat() if r[3] else None,
            "waiting_hours": round((now_naive - r[3]).total_seconds() / 3600, 1) if r[3] else None,
            "completeness_score": int(r[4] or 0),
        }
        for r in waiting_rows
    ]

    # Recent admin actions — the audit table may not exist yet on a fresh DB,
    # so read it inside a savepoint and degrade to [] instead of failing.
    recent_admin_actions: list[dict[str, Any]] = []
    try:
        async with db.begin_nested():
            arows = (await db.execute(sa_text("""
                SELECT created_at, actor_email, action, target_type, target_id, target_label, summary
                FROM admin_audit_logs WHERE tenant_id = :tid
                ORDER BY created_at DESC LIMIT 10
            """), {"tid": tid})).all()
        recent_admin_actions = [
            {
                "created_at": r[0].isoformat() if r[0] else None,
                "actor_email": r[1], "action": r[2], "target_type": r[3],
                "target_id": r[4], "target_label": r[5], "summary": r[6],
            }
            for r in arows
        ]
    except Exception as exc:
        logger.warning("dashboard_audit_read_failed", error=str(exc))

    return {
        "deltas": {
            "new_prev_7d": int(new_prev_7d or 0),
            "new_prev_30d": int(new_prev_30d or 0),
            "revenue_prev_month_paise": int(revenue_prev_month or 0),
            "interests_prev_30d": int(interests_prev_30d or 0),
            "messages_prev_30d": int(messages_prev_30d or 0),
        },
        "funnel": {
            "profile_complete": int(profile_complete or 0),
            "submitted": int(submitted_ever or 0),
            "paid": int(paid_members or 0),
        },
        "engagement": {
            "interests_30d": int(interests_30d or 0),
            "mutual_matches_total": int(mutual_total or 0),
            "mutual_matches_30d": int(mutual_30d or 0),
            "messages_30d": int(messages_30d or 0),
        },
        "active_subscriptions_by_plan": [
            {"plan": k, "count": v["count"], "amount_paise": v["amount_paise"]} for k, v in active_by_plan.items()
        ],
        "gender_distribution": [{"gender": r[0], "count": int(r[1])} for r in gender_rows],
        "country_distribution": [{"country": r[0], "count": int(r[1])} for r in country_rows],
        "verification_sla": {
            "avg_review_hours_30d": round(float(avg_review_hours), 1) if avg_review_hours is not None else None,
            "oldest_pending": oldest_pending,
        },
        "enquiries": {"new": int(new_enquiries or 0)},
        "recent_admin_actions": recent_admin_actions,
    }


# ─── Admin users (people with the `admin` claim) ─────────────────────────────


@router.get("/admins", response_model=APIResponse[list[dict]])
async def list_admins(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """List Firebase users that carry the `admin` or `super_admin` custom claim."""
    _require_admin(current_user)
    app = get_firebase_app()
    if app is None:
        return APIResponse(success=True, data=[])
    out: list[dict] = []
    try:
        # Page through all users; for launch-scale this is fine.
        page = firebase_auth.list_users(max_results=1000, app=app)
        while page:
            for u in page.users:
                claims = u.custom_claims or {}
                roles = claims.get("roles") or []
                if not isinstance(roles, list):
                    roles = [roles]
                if "admin" in roles or "super_admin" in roles:
                    out.append({
                        "uid": u.uid,
                        "email": u.email,
                        "display_name": u.display_name,
                        "disabled": bool(u.disabled),
                        "email_verified": bool(u.email_verified),
                        "last_sign_in": u.user_metadata.last_sign_in_timestamp if u.user_metadata else None,
                        "created": u.user_metadata.creation_timestamp if u.user_metadata else None,
                        "roles": roles,
                    })
            page = page.get_next_page() if page.has_next_page else None
    except Exception as exc:
        logger.error("list_admins_failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Could not list admins")
    out.sort(key=lambda r: (r.get("email") or "").lower())
    return APIResponse(success=True, data=out)


@router.post("/admins", response_model=APIResponse[dict])
async def grant_admin(
    payload: dict,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Grant admin to a Firebase user by email. Only super_admins can do this.
    payload = { "email": "...", "create": bool, "password": "..." (if create) }
    """
    if "super_admin" not in _roles_from_claims(current_user):
        raise HTTPException(status_code=403, detail="Super admin required")
    app = get_firebase_app()
    if app is None:
        raise HTTPException(status_code=503, detail="Firebase not configured")

    email = (payload.get("email") or "").strip().lower()
    create = bool(payload.get("create"))
    password = payload.get("password")
    if not email:
        raise HTTPException(status_code=400, detail="email required")

    try:
        user = firebase_auth.get_user_by_email(email, app=app)
        if create and password:
            firebase_auth.update_user(user.uid, password=password, app=app)
    except firebase_auth.UserNotFoundError:
        if not create or not password:
            raise HTTPException(status_code=404, detail="User not found; pass create=true + password to provision")
        user = firebase_auth.create_user(email=email, password=password, email_verified=True, app=app)

    current = user.custom_claims or {}
    roles = list(current.get("roles") or [])
    if "admin" not in roles:
        roles.append("admin")
    new_claims = {**current, "roles": roles}
    firebase_auth.set_custom_user_claims(user.uid, new_claims, app=app)
    logger.info("admin_granted", uid=user.uid, email=email, by=current_user.get("sub"))
    await record_admin_action(None, current_user, "admin.grant", target_type="admin", target_id=user.uid, target_label=email, details={"roles": roles, "created": bool(create)})
    return APIResponse(success=True, data={"uid": user.uid, "email": user.email, "roles": roles})


@router.delete("/admins/{uid}", response_model=APIResponse[dict])
async def revoke_admin(
    uid: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    if "super_admin" not in _roles_from_claims(current_user):
        raise HTTPException(status_code=403, detail="Super admin required")
    app = get_firebase_app()
    if app is None:
        raise HTTPException(status_code=503, detail="Firebase not configured")

    try:
        user = firebase_auth.get_user(uid, app=app)
    except firebase_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    current = user.custom_claims or {}
    roles = [r for r in (current.get("roles") or []) if r != "admin"]
    new_claims = {**current, "roles": roles}
    if not roles:
        new_claims.pop("roles", None)
    firebase_auth.set_custom_user_claims(uid, new_claims, app=app)
    try:
        firebase_auth.revoke_refresh_tokens(uid, app=app)
    except Exception:
        pass
    logger.info("admin_revoked", uid=uid, by=current_user.get("sub"))
    await record_admin_action(None, current_user, "admin.revoke", target_type="admin", target_id=uid, target_label=user.email)
    return APIResponse(success=True, data={"uid": uid})


# ─── Reports ─────────────────────────────────────────────────────────────────


@router.get("/reports", response_model=PaginatedResponse[dict])
async def list_reports_enriched(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    status_filter: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Tenant-scoped, enriched reports list with reporter/reported names."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)

    q = select(Report).where(Report.tenant_id == tenant_uuid, Report.deleted_at.is_(None))
    if status_filter:
        try:
            q = q.where(Report.status == ReportStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown status {status_filter!r}")

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    offset = (page - 1) * limit
    rows = (await db.execute(
        q.order_by(Report.created_at.desc()).offset(offset).limit(limit)
    )).scalars().all()

    # Bulk-fetch names for all involved users
    user_ids: set[uuid.UUID] = set()
    for r in rows:
        user_ids.add(r.reporter_id)
        user_ids.add(r.reported_user_id)
        if r.admin_id:
            user_ids.add(r.admin_id)
    names: dict[uuid.UUID, str] = {}
    if user_ids:
        name_rows = (await db.execute(
            select(UserProfile.user_id, UserProfile.first_name, UserProfile.last_name)
            .where(UserProfile.user_id.in_(user_ids))
        )).all()
        for uid_, fn, ln in name_rows:
            names[uid_] = f"{(fn or '').strip()} {(ln or '').strip()}".strip() or "(unnamed)"

    items = []
    for r in rows:
        items.append({
            "id": str(r.id),
            "category": r.category.value if r.category else None,
            "status": r.status.value if r.status else None,
            "description": r.description,
            "evidence": r.evidence or [],
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            "reporter_id": str(r.reporter_id),
            "reporter_name": names.get(r.reporter_id, "(unknown)"),
            "reported_user_id": str(r.reported_user_id),
            "reported_user_name": names.get(r.reported_user_id, "(unknown)"),
            "admin_id": str(r.admin_id) if r.admin_id else None,
            "admin_notes": r.admin_notes,
            "action_taken": r.action_taken,
        })
    return PaginatedResponse.create(items=items, total=total, page=page, limit=limit)


@router.put("/reports/{report_id}", response_model=APIResponse[dict])
async def resolve_report_enriched(
    report_id: uuid.UUID,
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)

    r = (await db.execute(
        select(Report).where(
            Report.id == report_id,
            Report.tenant_id == tenant_uuid,
            Report.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        r.status = ReportStatus((payload.get("status") or "").strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
    r.admin_notes = payload.get("admin_notes") or None
    r.action_taken = payload.get("action_taken") or None
    try:
        r.admin_id = uuid.UUID(current_user.get("sub", ""))
    except (ValueError, AttributeError):
        pass
    r.resolved_at = datetime.now(timezone.utc)
    await db.flush()
    logger.info("report_resolved", report_id=str(report_id), status=r.status.value, by=current_user.get("sub"))
    await record_admin_action(db, current_user, f"report.{r.status.value}", tenant_id=tenant_uuid, target_type="report", target_id=r.id, target_label=(r.category.value if r.category else None), summary=r.action_taken or r.admin_notes, details={"reported_user_id": str(r.reported_user_id)})
    return APIResponse(success=True, data={"id": str(r.id), "status": r.status.value})
