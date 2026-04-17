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

router = APIRouter(prefix="/admin", tags=["admin"])
logger = get_logger(__name__)


def _require_admin(current_user: dict) -> None:
    if not has_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin required")


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
        "email": u.email,
        "phone": u.phone,
        "is_active": bool(u.is_active),
        "is_phone_verified": bool(u.is_phone_verified),
        "is_email_verified": bool(u.is_email_verified),
        "is_profile_complete": bool(u.is_profile_complete),
        "trust_score": int(u.trust_score or 0),
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
    }


USER_CSV_COLS = [
    "id", "first_name", "last_name", "email", "phone", "city", "country",
    "religion", "occupation", "subscription_tier", "verification_status",
    "trust_score", "completeness_score", "is_active", "is_email_verified",
    "is_phone_verified", "created_at", "last_active_at",
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
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)

    base = (
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.tenant_id == tenant_uuid)
    )

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
        base = base.where(or_(
            func.lower(User.email).like(ql),
            User.phone.like(f"%{q}%"),
            func.lower(UserProfile.first_name).like(ql),
            func.lower(UserProfile.last_name).like(ql),
        ))

    # CSV streams the *filtered* set, ignoring page/limit.
    if (format or "").lower() == "csv":
        rows = (await db.execute(base.order_by(User.created_at.desc()))).all()
        return _stream_csv(
            filename="users.csv",
            cols=USER_CSV_COLS,
            row_iter=(_csv_row(_serialize_user(u, p), USER_CSV_COLS) for u, p in rows),
        )

    total: int = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    offset = (page - 1) * limit
    rows = (await db.execute(
        base.order_by(User.created_at.desc()).offset(offset).limit(limit)
    )).all()

    items = [_serialize_user(u, p) for u, p in rows]
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

    base = _serialize_user(u, p)
    profile = ProfileRead.model_validate(p, from_attributes=True).model_dump(mode="json") if p else None

    # Counts of related items
    reports_against = (await db.execute(
        select(func.count()).where(Report.reported_user_id == user_id, Report.deleted_at.is_(None))
    )).scalar_one()
    reports_filed = (await db.execute(
        select(func.count()).where(Report.reporter_id == user_id, Report.deleted_at.is_(None))
    )).scalar_one()

    return APIResponse(success=True, data={**base, "profile": profile, "reports_against": reports_against, "reports_filed": reports_filed})


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
    u.deleted_at = None
    u.is_active = True
    prof = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )).scalar_one_or_none()
    if prof and prof.deleted_at is not None:
        prof.deleted_at = None
    await db.flush()
    logger.info("admin_restore_user", admin=current_user.get("sub"), target=str(user_id))
    return APIResponse(success=True, data={"id": str(u.id)})


@router.post("/users/{user_id}/trust-boost", response_model=APIResponse[dict])
async def trust_boost(
    user_id: uuid.UUID,
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid_from_slug(db, tenant_slug)
    try:
        delta = int(payload.get("delta", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="delta must be an integer")
    if delta == 0:
        raise HTTPException(status_code=400, detail="delta must be non-zero")
    u = await _load_user_for_admin(db, user_id, tenant_uuid)
    u.trust_score = max(0, min(100, (u.trust_score or 0) + delta))
    await db.flush()
    logger.info("admin_trust_boost", admin=current_user.get("sub"), target=str(user_id), delta=delta)
    return APIResponse(success=True, data={"id": str(u.id), "trust_score": u.trust_score})


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

    # Registration trend (last 14 days, bucketed by day)
    trend_rows = (await db.execute(sa_text("""
        SELECT DATE(created_at AT TIME ZONE 'UTC') AS d, COUNT(*) AS c
        FROM users
        WHERE tenant_id = :tid AND deleted_at IS NULL
          AND created_at >= NOW() - INTERVAL '14 days'
        GROUP BY d
        ORDER BY d
    """), {"tid": str(tenant_uuid)})).all()
    trend = [{"date": r[0].isoformat(), "count": int(r[1])} for r in trend_rows]

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
    plan_rows = (await db.execute(sa_text("""
        SELECT subscription_tier::text AS t, COUNT(*) AS c
        FROM users
        WHERE tenant_id = :tid AND deleted_at IS NULL
        GROUP BY subscription_tier
    """), {"tid": str(tenant_uuid)})).all()
    # Always present all four tiers, even at 0, so the dashboard renders cleanly.
    plan_counts = {t.value: 0 for t in SubscriptionTier}
    for r in plan_rows:
        plan_counts[r[0]] = int(r[1])
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
        "religion_distribution": religion,
        "recent_activity": recent,
    })


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
    return APIResponse(success=True, data={"id": str(r.id), "status": r.status.value})
