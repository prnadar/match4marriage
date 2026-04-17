"""
Admin: payments + subscriptions surface area.

Powers /admin/payments and /admin/subscriptions in the dashboard.
"""
from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user, has_admin_role
from app.core.tenancy import get_current_tenant_slug
from app.models.subscription import (
    CreditTransaction,
    PaymentGateway,
    Subscription,
    SubscriptionStatus,
)
from app.models.user import User, UserProfile
from app.schemas.common import APIResponse, PaginatedResponse

router = APIRouter(prefix="/admin", tags=["admin-payments"])
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


def _user_label(first_name: str | None, last_name: str | None, email: str | None) -> str:
    name = f"{(first_name or '').strip()} {(last_name or '').strip()}".strip()
    return name or (email or "(unnamed)")


# ─── Payments (credit transactions) ──────────────────────────────────────────


PAYMENTS_CSV_COLS = [
    "id", "user_id", "user_name", "user_email", "amount", "balance_after",
    "description", "reference_id", "gateway", "created_at",
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


@router.get("/payments", response_model=PaginatedResponse[dict])
async def list_payments(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    q: str | None = Query(default=None, description="Search by user name or email"),
    gateway: str | None = Query(default=None, description="razorpay | stripe | upi"),
    direction: str | None = Query(default=None, description="credit | debit"),
    days: int | None = Query(default=None, ge=1, le=365, description="Limit to last N days"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    format: str | None = Query(default=None, description="json (default) | csv"),
):
    """Paginated, filterable list of credit transactions joined with user info."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)

    base = (
        select(CreditTransaction, User, UserProfile)
        .join(User, User.id == CreditTransaction.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(CreditTransaction.tenant_id == tenant_uuid)
    )

    if gateway:
        base = base.where(CreditTransaction.gateway == gateway)
    if direction == "credit":
        base = base.where(CreditTransaction.amount > 0)
    elif direction == "debit":
        base = base.where(CreditTransaction.amount < 0)
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        base = base.where(CreditTransaction.created_at >= cutoff)
    if q:
        ql = f"%{q.lower()}%"
        base = base.where(or_(
            func.lower(User.email).like(ql),
            func.lower(UserProfile.first_name).like(ql),
            func.lower(UserProfile.last_name).like(ql),
        ))

    if (format or "").lower() == "csv":
        rows = (await db.execute(
            base.order_by(CreditTransaction.created_at.desc())
        )).all()
        def to_dict(tx, u, p):
            return {
                "id": str(tx.id),
                "user_id": str(tx.user_id),
                "user_name": _user_label(p.first_name if p else None, p.last_name if p else None, u.email),
                "user_email": u.email,
                "amount": int(tx.amount),
                "balance_after": int(tx.balance_after),
                "description": tx.description,
                "reference_id": tx.reference_id,
                "gateway": tx.gateway,
                "created_at": tx.created_at.isoformat() if tx.created_at else None,
            }
        return _stream_csv(
            "payments.csv", PAYMENTS_CSV_COLS,
            (_csv_row(to_dict(tx, u, p), PAYMENTS_CSV_COLS) for tx, u, p in rows),
        )

    total: int = (await db.execute(
        select(func.count()).select_from(base.subquery())
    )).scalar_one()

    offset = (page - 1) * limit
    rows = (await db.execute(
        base.order_by(CreditTransaction.created_at.desc()).offset(offset).limit(limit)
    )).all()

    items: list[dict[str, Any]] = []
    for tx, u, p in rows:
        items.append({
            "id": str(tx.id),
            "user_id": str(tx.user_id),
            "user_name": _user_label(p.first_name if p else None, p.last_name if p else None, u.email),
            "user_email": u.email,
            "amount": int(tx.amount),
            "balance_after": int(tx.balance_after),
            "description": tx.description,
            "reference_id": tx.reference_id,
            "gateway": tx.gateway,
            "created_at": tx.created_at.isoformat() if tx.created_at else None,
        })

    return PaginatedResponse.create(items=items, total=total, page=page, limit=limit)


@router.get("/payments/summary", response_model=APIResponse[dict])
async def payments_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Top-of-page totals strip for the payments page."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)

    # subscriptions.current_period_start is TIMESTAMP WITHOUT TIME ZONE, so
    # comparison values must be naive too.
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    month_start = datetime(now.year, now.month, 1)

    async def _sum(filter_q) -> int:
        v = (await db.execute(
            select(func.coalesce(func.sum(Subscription.amount_paise), 0))
            .where(Subscription.tenant_id == tenant_uuid)
            .where(Subscription.status.in_([
                SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED,
                SubscriptionStatus.PAST_DUE, SubscriptionStatus.EXPIRED,
            ]))
            .where(filter_q)
        )).scalar_one()
        return int(v or 0)

    today = await _sum(Subscription.current_period_start >= today_start)
    this_month = await _sum(Subscription.current_period_start >= month_start)
    lifetime = await _sum(Subscription.current_period_start >= datetime(1970, 1, 1))

    return APIResponse(success=True, data={
        "today_paise": today,
        "this_month_paise": this_month,
        "lifetime_paise": lifetime,
    })


# ─── Subscriptions ──────────────────────────────────────────────────────────


@router.get("/subscriptions", response_model=PaginatedResponse[dict])
async def list_subscriptions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, description="active | paused | cancelled | expired | past_due"),
    plan: str | None = Query(default=None, description="silver | gold | platinum"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Paginated, filterable list of subscriptions joined with user info."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)

    base = (
        select(Subscription, User, UserProfile)
        .join(User, User.id == Subscription.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(Subscription.tenant_id == tenant_uuid)
    )

    if status_filter:
        try:
            base = base.where(Subscription.status == SubscriptionStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown status {status_filter!r}")
    if plan:
        base = base.where(Subscription.plan == plan)
    if q:
        ql = f"%{q.lower()}%"
        base = base.where(or_(
            func.lower(User.email).like(ql),
            func.lower(UserProfile.first_name).like(ql),
            func.lower(UserProfile.last_name).like(ql),
        ))

    total: int = (await db.execute(
        select(func.count()).select_from(base.subquery())
    )).scalar_one()

    offset = (page - 1) * limit
    rows = (await db.execute(
        base.order_by(Subscription.current_period_end.desc()).offset(offset).limit(limit)
    )).all()

    items: list[dict[str, Any]] = []
    for s, u, p in rows:
        items.append({
            "id": str(s.id),
            "user_id": str(s.user_id),
            "user_name": _user_label(p.first_name if p else None, p.last_name if p else None, u.email),
            "user_email": u.email,
            "plan": s.plan,
            "status": s.status.value if s.status else None,
            "gateway": s.gateway.value if s.gateway else None,
            "amount_paise": int(s.amount_paise),
            "currency": s.currency,
            "current_period_start": s.current_period_start.isoformat() if s.current_period_start else None,
            "current_period_end": s.current_period_end.isoformat() if s.current_period_end else None,
            "cancelled_at": s.cancelled_at.isoformat() if s.cancelled_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return PaginatedResponse.create(items=items, total=total, page=page, limit=limit)


@router.get("/subscriptions/expiring", response_model=APIResponse[list[dict]])
async def list_expiring_subscriptions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    days: int = Query(default=14, ge=1, le=90),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Active subscriptions whose current_period_end falls inside the next N days."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)

    # current_period_end is naive — use naive datetimes throughout.
    now = datetime.utcnow()
    until = now + timedelta(days=days)

    base = (
        select(Subscription, User, UserProfile)
        .join(User, User.id == Subscription.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(Subscription.tenant_id == tenant_uuid)
        .where(Subscription.status == SubscriptionStatus.ACTIVE)
        .where(Subscription.current_period_end >= now)
        .where(Subscription.current_period_end <= until)
        .order_by(Subscription.current_period_end.asc())
        .limit(limit)
    )
    rows = (await db.execute(base)).all()

    items: list[dict[str, Any]] = []
    for s, u, p in rows:
        items.append({
            "id": str(s.id),
            "user_id": str(s.user_id),
            "user_name": _user_label(p.first_name if p else None, p.last_name if p else None, u.email),
            "user_email": u.email,
            "plan": s.plan,
            "amount_paise": int(s.amount_paise),
            "current_period_end": s.current_period_end.isoformat() if s.current_period_end else None,
        })

    return APIResponse(success=True, data=items)
