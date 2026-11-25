"""
Admin member tools — everything staff do on ONE member beyond the CRM card.

  GET   /admin/members/{id}/overview      Member 360 (read-only): interests,
                                          matches + introductions, chat activity
                                          (counts only — never message content),
                                          subscriptions/payments, verification
                                          history, account activity
  GET   /admin/members/{id}/membership    current plan + what staff can do next
  POST  /admin/members/{id}/membership    grant / extend / change / end a plan
                                          (offline payments) — reason + audit
  GET   /admin/members/{id}/profile       the editable subset + choices
  PATCH /admin/members/{id}/profile       edit a safe subset on the member's
                                          behalf — reason + audit

Every route requires the admin role (router-level dependency AND a per-route
check, like the other admin routers) and every query is tenant-scoped.

NOTE: no `from __future__ import annotations` in this module on purpose — it
breaks FastAPI's parameter resolution for slowapi-decorated routes.
"""
import uuid
from datetime import date, datetime, time as dtime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.entitlements import PLAN_RANK, normalize_plan
from app.core.logging import get_logger
from app.core.security import get_current_user, has_admin_role, require_admin
from app.core.tenancy import get_current_tenant_slug
from app.models.admin_audit_log import AdminAuditLog
from app.models.match import ChatThread, Interest, Match, Message
from app.models.notification import Notification
from app.models.report import Report
from app.models.subscription import CreditTransaction, PaymentGateway, Subscription, SubscriptionStatus
from app.models.user import Gender, MaritalStatus, SubscriptionTier, User, UserProfile
from app.models.verification import Verification
from app.schemas.common import APIResponse
from app.services.audit import record_admin_action
from app.services.notifications import create_notification
from app.services.profile_completeness import compute_profile_completeness

logger = get_logger(__name__)

router = APIRouter(
    prefix="/admin/members",
    tags=["admin-members"],
    # Belt and braces: every route below also calls _require_admin().
    dependencies=[Depends(require_admin)],
)

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[dict, Depends(get_current_user)]


# ─── Shared helpers ──────────────────────────────────────────────────────────


def _require_admin(current_user: dict) -> None:
    if not has_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin required")


async def _tenant(db: AsyncSession, tenant_slug: str) -> uuid.UUID:
    from app.routers.profile import _resolve_tenant_uuid
    t = await _resolve_tenant_uuid(db, tenant_slug)
    if t is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return t


async def _load_member(db: AsyncSession, tenant_uuid: uuid.UUID, user_id: uuid.UUID) -> tuple[User, UserProfile | None]:
    """Tenant-scoped load. Soft-deleted members are returned too (callers that
    write refuse them explicitly)."""
    row = (await db.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.id == user_id, User.tenant_id == tenant_uuid)
    )).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row[0], row[1]


def _iso(v: Any) -> str | None:
    return v.isoformat() if v is not None and hasattr(v, "isoformat") else None


def _ev(v: Any) -> Any:
    return getattr(v, "value", v)


def _name(p: UserProfile | None, u: User | None = None) -> str:
    if p is not None:
        n = f"{(p.first_name or '').strip()} {(p.last_name or '').strip()}".strip()
        if n:
            return n
    if u is not None:
        return u.membership_number or u.email or "(unnamed)"
    return "(unnamed)"


def _label(u: User, p: UserProfile | None) -> str:
    return _name(p, u)


async def _people(db: AsyncSession, tenant_uuid: uuid.UUID, ids: set[uuid.UUID]) -> dict[str, dict[str, Any]]:
    """Name + membership number for the other side of an interest/match. Opaque
    for anyone outside the tenant (never happens in practice; defensive)."""
    if not ids:
        return {}
    rows = (await db.execute(
        select(User.id, User.membership_number, User.deleted_at, UserProfile.first_name, UserProfile.last_name)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.tenant_id == tenant_uuid, User.id.in_(list(ids)))
    )).all()
    out: dict[str, dict[str, Any]] = {}
    for uid, number, deleted_at, first, last in rows:
        name = f"{(first or '').strip()} {(last or '').strip()}".strip() or number or "(unnamed)"
        out[str(uid)] = {"id": str(uid), "name": name, "membership_number": number, "is_deleted": deleted_at is not None}
    return out


def _person(people: dict[str, dict[str, Any]], uid: Any) -> dict[str, Any]:
    return people.get(str(uid)) or {"id": str(uid), "name": "Former member", "membership_number": None, "is_deleted": True}


# ─── Member 360 ──────────────────────────────────────────────────────────────

PLAN_LABELS = {"free": "Free", "silver": "Basic", "gold": "Premium", "platinum": "Elite"}
_LIST_LIMIT = 25


def _ser_subscription(s: Subscription) -> dict[str, Any]:
    raw = s.raw_webhook_data if isinstance(s.raw_webhook_data, dict) else {}
    manual = raw.get("source") == "admin"
    return {
        "id": str(s.id),
        "plan": s.plan,
        "plan_label": PLAN_LABELS.get((s.plan or "").lower(), (s.plan or "").title()),
        "status": _ev(s.status),
        "gateway": _ev(s.gateway),
        "reference": s.gateway_subscription_id,
        "amount_pence": int(s.amount_paise or 0),
        "currency": s.currency,
        "period_start": _iso(s.current_period_start),
        "period_end": _iso(s.current_period_end),
        "cancelled_at": _iso(s.cancelled_at),
        "created_at": _iso(s.created_at),
        # Offline payments recorded by staff carry their own context.
        "recorded_by": raw.get("admin_email") if manual else None,
        "payment_method": raw.get("payment_method") if manual else None,
        "payment_reference": raw.get("payment_reference") if manual else None,
        "reason": raw.get("reason") if manual else None,
        "superseded": bool(raw.get("superseded_by")),
        "events": [e for e in (raw.get("admin_events") or []) if isinstance(e, dict)][-10:],
    }


async def _active_subscriptions(db: AsyncSession, tenant_uuid: uuid.UUID, user_id: uuid.UUID) -> list[Subscription]:
    return list((await db.execute(
        select(Subscription).where(
            Subscription.tenant_id == tenant_uuid,
            Subscription.user_id == user_id,
            Subscription.deleted_at.is_(None),
            Subscription.status == SubscriptionStatus.ACTIVE,
        ).order_by(Subscription.current_period_end.desc())
    )).scalars().all())


def _membership_state(u: User, active: list[Subscription]) -> dict[str, Any]:
    """Access is governed by users.subscription_tier; the subscription row holds
    the paid period. Surface the cases where the two disagree."""
    tier = normalize_plan(_ev(u.subscription_tier))
    now = datetime.utcnow()  # subscription period columns are naive UTC
    cur = active[0] if active else None
    lapsed = bool(cur and cur.current_period_end and cur.current_period_end < now)
    warnings: list[str] = []
    if tier != "free" and cur is None:
        warnings.append("This member has paid-tier access but no active subscription record.")
    if lapsed:
        warnings.append("The paid period has ended but the member still has access — nothing expires plans automatically. Extend it or end the membership.")
    if cur and normalize_plan(cur.plan) != tier:
        warnings.append("The active subscription's plan doesn't match the member's access tier.")
    days_left = None
    if cur and cur.current_period_end:
        days_left = (cur.current_period_end.date() - now.date()).days
    return {
        "tier": tier,
        "plan_label": PLAN_LABELS[tier],
        "current": _ser_subscription(cur) if cur else None,
        "active_count": len(active),
        "period_lapsed": lapsed,
        "days_left": days_left,
        "warnings": warnings,
    }


@router.get("/{user_id}/overview", response_model=APIResponse[dict])
async def member_overview(
    user_id: uuid.UUID,
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Read-only Member 360. Chat is reported as counts and timestamps only;
    interest notes and message bodies are never returned."""
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    u, p = await _load_member(db, tenant_uuid, user_id)
    uid = u.id

    failed: list[str] = []

    async def _safe(label: str, fn, default):
        """Each section in its own SAVEPOINT: one missing table / odd row can't
        blank the whole panel or poison the request transaction."""
        try:
            async with db.begin_nested():
                return await fn()
        except Exception as exc:
            logger.warning("member_overview_section_failed", section=label, error=str(exc))
            failed.append(label)
            return default

    # ── Account activity ────────────────────────────────────────────────────
    from app.routers.auth import _mask_email, _mask_phone, _read_account_settings
    stored = await _read_account_settings(db, uid)
    deact = stored.get("deactivation") if isinstance(stored.get("deactivation"), dict) else None
    deletion = stored.get("deletion") if isinstance(stored.get("deletion"), dict) else None
    if u.deleted_at is not None:
        state = "deleted"
    elif not u.is_active:
        state = "deactivated" if (deact or {}).get("by") == "self" else "suspended"
    else:
        state = "active"
    account = {
        "state": state,
        "created_at": _iso(u.created_at),
        "last_active_at": _iso(u.last_active_at),
        "is_email_verified": bool(u.is_email_verified),
        "is_phone_verified": bool(u.is_phone_verified),
        "is_profile_complete": bool(u.is_profile_complete),
        "is_active": bool(u.is_active),
        "deleted_at": _iso(u.deleted_at),
        "membership_number": u.membership_number,
        "sign_in_methods": len(u.firebase_uids or []),
        "profile_created_at": _iso(p.created_at) if p else None,
        "profile_updated_at": _iso(p.updated_at) if p else None,
        "completeness_score": int(p.completeness_score or 0) if p else 0,
        "deactivation": {"at": deact.get("at"), "by": deact.get("by"), "reason": deact.get("reason")} if deact else None,
        "deletion": {
            "at": deletion.get("at"), "by": deletion.get("by"), "reason": deletion.get("reason"),
            "email_masked": _mask_email(deletion.get("email")), "phone_masked": _mask_phone(deletion.get("phone")),
        } if deletion else None,
        "reactivated_at": stored.get("reactivated_at"),
    }

    # ── Interests ───────────────────────────────────────────────────────────
    async def _interests():
        base = (Interest.tenant_id == tenant_uuid, Interest.deleted_at.is_(None))

        async def _side(col, other_col):
            counts = (await db.execute(
                select(Interest.status, func.count()).where(*base, col == uid).group_by(Interest.status)
            )).all()
            rows = (await db.execute(
                select(Interest).where(*base, col == uid).order_by(Interest.created_at.desc()).limit(_LIST_LIMIT)
            )).scalars().all()
            by_status = {str(_ev(s)): int(n) for s, n in counts}
            return rows, by_status, other_col

        sent_rows, sent_counts, _ = await _side(Interest.sender_id, Interest.receiver_id)
        recv_rows, recv_counts, _ = await _side(Interest.receiver_id, Interest.sender_id)
        people = await _people(db, tenant_uuid, {r.receiver_id for r in sent_rows} | {r.sender_id for r in recv_rows})

        def _ser(r: Interest, other: uuid.UUID) -> dict[str, Any]:
            return {
                "id": str(r.id), "member": _person(people, other), "status": _ev(r.status),
                "is_super_interest": bool(r.is_super_interest),
                "created_at": _iso(r.created_at), "responded_at": _iso(r.responded_at),
            }

        return {
            "sent": {"total": sum(sent_counts.values()), "by_status": sent_counts,
                     "items": [_ser(r, r.receiver_id) for r in sent_rows]},
            "received": {"total": sum(recv_counts.values()), "by_status": recv_counts,
                         "items": [_ser(r, r.sender_id) for r in recv_rows]},
        }

    interests = await _safe("interests", _interests, {
        "sent": {"total": 0, "by_status": {}, "items": []},
        "received": {"total": 0, "by_status": {}, "items": []},
    })

    # ── Matches + bureau introductions ──────────────────────────────────────
    async def _matches():
        cond = (Match.tenant_id == tenant_uuid, Match.deleted_at.is_(None),
                or_(Match.user_a_id == uid, Match.user_b_id == uid))
        counts = (await db.execute(select(Match.status, func.count()).where(*cond).group_by(Match.status))).all()
        rows = (await db.execute(
            select(Match).where(*cond).order_by(Match.mutual_at.desc().nullslast(), Match.created_at.desc()).limit(_LIST_LIMIT)
        )).scalars().all()
        intro_rows = (await db.execute(
            select(Notification).where(
                Notification.tenant_id == tenant_uuid, Notification.user_id == uid,
                Notification.type == "introduction",
            ).order_by(Notification.created_at.desc()).limit(_LIST_LIMIT)
        )).scalars().all()
        intro_ids: set[uuid.UUID] = set()
        for n in intro_rows:
            try:
                intro_ids.add(uuid.UUID(str((n.extra_data or {}).get("introduced_user_id"))))
            except (TypeError, ValueError):
                pass
        others = {(m.user_b_id if m.user_a_id == uid else m.user_a_id) for m in rows}
        people = await _people(db, tenant_uuid, others | intro_ids)
        by_status = {str(_ev(s)): int(n) for s, n in counts}
        return {
            "total": sum(by_status.values()),
            "by_status": by_status,
            "items": [{
                "id": str(m.id),
                "member": _person(people, m.user_b_id if m.user_a_id == uid else m.user_a_id),
                "status": _ev(m.status),
                "score": round(float(m.compatibility_score or 0)),
                "match_date": m.match_date,
                "mutual_at": _iso(m.mutual_at),
                "created_at": _iso(m.created_at),
            } for m in rows],
            "introductions": [{
                "id": str(n.id),
                "member": _person(people, (n.extra_data or {}).get("introduced_user_id")),
                "score": (n.extra_data or {}).get("score"),
                "seen": bool(n.is_read),
                "created_at": _iso(n.created_at),
            } for n in intro_rows],
        }

    matches = await _safe("matches", _matches, {"total": 0, "by_status": {}, "items": [], "introductions": []})

    # ── Chat activity: counts + timestamps ONLY ─────────────────────────────
    async def _chat():
        tcond = (ChatThread.tenant_id == tenant_uuid, ChatThread.deleted_at.is_(None),
                 or_(ChatThread.user_a_id == uid, ChatThread.user_b_id == uid))
        thread_ids = [r for (r,) in (await db.execute(select(ChatThread.id).where(*tcond))).all()]
        active_threads, last_thread_at = (await db.execute(
            select(func.count().filter(ChatThread.is_active.is_(True)), func.max(ChatThread.last_message_at)).where(*tcond)
        )).one()
        sent, last_sent = (await db.execute(
            select(func.count(), func.max(Message.created_at)).where(
                Message.tenant_id == tenant_uuid, Message.sender_id == uid, Message.deleted_at.is_(None))
        )).one()
        received, last_received = 0, None
        if thread_ids:
            received, last_received = (await db.execute(
                select(func.count(), func.max(Message.created_at)).where(
                    Message.tenant_id == tenant_uuid, Message.thread_id.in_(thread_ids),
                    Message.sender_id != uid, Message.deleted_at.is_(None))
            )).one()
        return {
            "threads": len(thread_ids),
            "active_threads": int(active_threads or 0),
            "messages_sent": int(sent or 0),
            "messages_received": int(received or 0),
            "last_message_sent_at": _iso(last_sent),
            "last_message_received_at": _iso(last_received),
            "last_thread_activity_at": _iso(last_thread_at),
        }

    chat = await _safe("chat", _chat, {
        "threads": 0, "active_threads": 0, "messages_sent": 0, "messages_received": 0,
        "last_message_sent_at": None, "last_message_received_at": None, "last_thread_activity_at": None,
    })

    # ── Subscriptions + payments ────────────────────────────────────────────
    async def _billing():
        subs = (await db.execute(
            select(Subscription).where(
                Subscription.tenant_id == tenant_uuid, Subscription.user_id == uid, Subscription.deleted_at.is_(None),
            ).order_by(Subscription.created_at.desc()).limit(50)
        )).scalars().all()
        credits = (await db.execute(
            select(CreditTransaction).where(
                CreditTransaction.tenant_id == tenant_uuid, CreditTransaction.user_id == uid,
            ).order_by(CreditTransaction.created_at.desc()).limit(50)
        )).scalars().all()
        active = [s for s in subs if s.status == SubscriptionStatus.ACTIVE]
        active.sort(key=lambda s: s.current_period_end or datetime.min, reverse=True)
        paid = [s for s in subs if s.status != SubscriptionStatus.CANCELLED]
        return {
            "membership": _membership_state(u, active),
            "subscriptions": [_ser_subscription(s) for s in subs],
            "total_paid_pence": sum(int(s.amount_paise or 0) for s in paid),
            "currency": (subs[0].currency if subs else "GBP"),
            "credit_transactions": [{
                "id": str(c.id), "amount": int(c.amount), "balance_after": int(c.balance_after),
                "description": c.description, "reference_id": c.reference_id, "gateway": c.gateway,
                "created_at": _iso(c.created_at),
            } for c in credits],
        }

    billing = await _safe("billing", _billing, {
        "membership": _membership_state(u, []), "subscriptions": [], "total_paid_pence": 0,
        "currency": "GBP", "credit_transactions": [],
    })

    # ── Verification history ────────────────────────────────────────────────
    async def _verification():
        verifs = (await db.execute(
            select(Verification).where(
                Verification.tenant_id == tenant_uuid, Verification.user_id == uid, Verification.deleted_at.is_(None),
            ).order_by(Verification.updated_at.desc())
        )).scalars().all()
        history = (await db.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.tenant_id == tenant_uuid,
                AdminAuditLog.target_id == str(uid),
                AdminAuditLog.action.like("verification.%"),
            ).order_by(AdminAuditLog.created_at.desc()).limit(25)
        )).scalars().all()
        return {
            "status": p.verification_status if p else "draft",
            "submitted_at": _iso(p.submitted_at) if p else None,
            "reviewed_at": _iso(p.reviewed_at) if p else None,
            "rejection_reason": p.rejection_reason if p else None,
            "last_rejection_reason": p.last_rejection_reason if p else None,
            # Document *facts* only — images and numbers stay behind the
            # verification review screen (which is itself view-audited).
            "checks": [{
                "id": str(v.id), "type": _ev(v.verification_type), "status": _ev(v.status),
                "doc_type": (v.provider_response or {}).get("doc_type"),
                "doc_country": (v.provider_response or {}).get("doc_country"),
                "submitted_at": _iso(v.updated_at or v.created_at), "verified_at": _iso(v.verified_at),
            } for v in verifs],
            "history": [{
                "id": str(h.id), "action": h.action, "actor_email": h.actor_email,
                "summary": h.summary, "created_at": _iso(h.created_at),
            } for h in history],
        }

    verification = await _safe("verification", _verification, {
        "status": p.verification_status if p else "draft", "submitted_at": None, "reviewed_at": None,
        "rejection_reason": None, "last_rejection_reason": None, "checks": [], "history": [],
    })

    # ── Reports + recent admin actions on this member ───────────────────────
    async def _safety():
        against = (await db.execute(select(func.count()).select_from(Report).where(
            Report.tenant_id == tenant_uuid, Report.reported_user_id == uid, Report.deleted_at.is_(None)))).scalar_one()
        filed = (await db.execute(select(func.count()).select_from(Report).where(
            Report.tenant_id == tenant_uuid, Report.reporter_id == uid, Report.deleted_at.is_(None)))).scalar_one()
        return {"reports_against": int(against or 0), "reports_filed": int(filed or 0)}

    safety = await _safe("safety", _safety, {"reports_against": 0, "reports_filed": 0})

    async def _admin_activity():
        rows = (await db.execute(
            select(AdminAuditLog).where(
                AdminAuditLog.tenant_id == tenant_uuid, AdminAuditLog.target_id == str(uid),
            ).order_by(AdminAuditLog.created_at.desc()).limit(15)
        )).scalars().all()
        return [{
            "id": str(h.id), "action": h.action, "actor_email": h.actor_email,
            "summary": h.summary, "created_at": _iso(h.created_at),
        } for h in rows]

    admin_activity = await _safe("admin_activity", _admin_activity, [])

    # last_active_at isn't written by every code path, so also derive the most
    # recent thing the member demonstrably did.
    signals = [
        ("Sent a message", chat.get("last_message_sent_at")),
        ("Sent an interest", (interests["sent"]["items"][0]["created_at"] if interests["sent"]["items"] else None)),
        ("Updated their profile", account["profile_updated_at"]),
        ("Last active", account["last_active_at"]),
    ]
    dated = [(label, ts) for label, ts in signals if ts]
    if dated:
        label, ts = max(dated, key=lambda x: x[1][:19])
        account["last_seen"] = {"label": label, "at": ts}
    else:
        account["last_seen"] = None

    return APIResponse(success=True, data={
        "user_id": str(uid),
        "name": _name(p, u),
        "account": account,
        "interests": interests,
        "matches": matches,
        "chat": chat,
        "billing": billing,
        "verification": verification,
        "safety": safety,
        "admin_activity": admin_activity,
        "sections_failed": failed,
    })


# ─── Membership management (offline payments) ────────────────────────────────

PAID_PLANS = ("silver", "gold", "platinum")
PAYMENT_METHODS = ("cash", "bank_transfer", "card_terminal", "cheque", "complimentary", "other")
PAYMENT_METHOD_LABELS = {
    "cash": "Cash", "bank_transfer": "Bank transfer", "card_terminal": "Card (in person / terminal)",
    "cheque": "Cheque", "complimentary": "Complimentary (no charge)", "other": "Other",
}
_MAX_TERM_DAYS = 1095  # 3 years


class MembershipChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["grant", "extend", "change", "end"]
    plan: Literal["silver", "gold", "platinum"] | None = None
    # Either a number of days or an explicit last day of the period.
    days: int | None = Field(default=None, ge=1, le=_MAX_TERM_DAYS)
    period_end: date | None = None
    amount_pence: int | None = Field(default=None, ge=0, le=5_000_000)
    payment_method: Literal["cash", "bank_transfer", "card_terminal", "cheque", "complimentary", "other"] | None = None
    payment_reference: str | None = Field(default=None, max_length=120)
    refunded: bool = False
    reason: str = Field(min_length=1, max_length=500)
    notify_member: bool = True
    # Must be true for anything that removes access (end, downgrade).
    confirm: bool = False

    @field_validator("reason")
    @classmethod
    def _reason(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 5:
            raise ValueError("Give a reason of at least 5 characters — it goes in the audit log.")
        return v

    @field_validator("payment_reference")
    @classmethod
    def _ref(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None


async def _plan_catalog(db: AsyncSession, tenant_uuid: uuid.UUID) -> list[dict[str, Any]]:
    """Paid plans with the price members see (admin-managed pricing_plans, with
    the settings fallback) so the offline-payment form can pre-fill the amount."""
    from app.models.pricing_plan import PricingPlan
    from app.routers.subscriptions import PLAN_PRICE_GBP_PENCE, PLAN_TERM_DAYS

    rows = (await db.execute(
        select(PricingPlan).where(
            PricingPlan.tenant_id == tenant_uuid, PricingPlan.is_active == True,  # noqa: E712
            PricingPlan.deleted_at.is_(None),
        ).order_by(PricingPlan.sort_order.asc())
    )).scalars().all()
    by_tier: dict[str, PricingPlan] = {}
    for r in rows:
        by_tier.setdefault((r.tier or "").lower(), r)
    out = []
    for tier in PAID_PLANS:
        r = by_tier.get(tier)
        out.append({
            "plan": tier,
            "label": PLAN_LABELS[tier],
            "price_pence": int(r.price_paise) if r is not None else int(PLAN_PRICE_GBP_PENCE.get(tier, 0)),
            "currency": ((r.currency if r is not None else None) or "GBP").upper(),
            "term_days": int(PLAN_TERM_DAYS.get(tier, 180)),
        })
    return out


@router.get("/{user_id}/membership", response_model=APIResponse[dict])
async def get_membership(
    user_id: uuid.UUID,
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    u, _p = await _load_member(db, tenant_uuid, user_id)
    active = await _active_subscriptions(db, tenant_uuid, u.id)
    return APIResponse(success=True, data={
        **_membership_state(u, active),
        "is_deleted": u.deleted_at is not None,
        "plans": await _plan_catalog(db, tenant_uuid),
        "payment_methods": [{"value": m, "label": PAYMENT_METHOD_LABELS[m]} for m in PAYMENT_METHODS],
        "max_term_days": _MAX_TERM_DAYS,
    })


def _resolve_period_end(payload: MembershipChange, *, base: datetime, default_days: int | None) -> datetime:
    """Naive-UTC end of the paid period (subscriptions.current_period_* are
    TIMESTAMP WITHOUT TIME ZONE — asyncpg rejects tz-aware values)."""
    if payload.period_end is not None and payload.days is not None:
        raise HTTPException(status_code=422, detail="Send either days or period_end, not both.")
    if payload.period_end is not None:
        return datetime.combine(payload.period_end, dtime(23, 59, 59))
    days = payload.days if payload.days is not None else default_days
    if days is None:
        raise HTTPException(status_code=422, detail="Say how long: a number of days or an end date.")
    return base + timedelta(days=days)


async def _ensure_manual_gateway_label() -> None:
    """Request-time fallback for the boot guard in main.py: add the 'MANUAL'
    label to the Postgres `paymentgateway` enum if a cold boot skipped it.
    Lightweight lock on the type only — never on a table. Postgres only."""
    from sqlalchemy import text
    from app.core.database import engine
    async with engine.connect() as conn:
        if conn.dialect.name != "postgresql":
            return
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        await conn.execute(text("ALTER TYPE paymentgateway ADD VALUE IF NOT EXISTS 'MANUAL'"))


async def _insert_manual_subscription(db: AsyncSession, sub: Subscription) -> None:
    async def _write() -> None:
        async with db.begin_nested():
            db.add(sub)
            await db.flush()

    try:
        await _write()
    except Exception as first_exc:
        logger.warning("manual_subscription_insert_retry", error=str(first_exc))
        try:
            db.expunge(sub)
        except Exception:
            pass
        try:
            await _ensure_manual_gateway_label()
            await _write()
        except Exception as exc:
            logger.error("manual_subscription_insert_failed", error=str(exc))
            raise HTTPException(
                status_code=503,
                detail="Couldn't record the membership right now. Nothing was changed — please try again in a minute.",
            )


def _append_event(sub: Subscription, event: dict[str, Any], **extra: Any) -> None:
    """raw_webhook_data is a plain JSON column: reassign a NEW dict so the
    change is detected and persisted."""
    raw = dict(sub.raw_webhook_data) if isinstance(sub.raw_webhook_data, dict) else {}
    events = [e for e in (raw.get("admin_events") or []) if isinstance(e, dict)]
    events.append(event)
    raw["admin_events"] = events[-50:]
    raw.update(extra)
    sub.raw_webhook_data = raw


@router.post("/{user_id}/membership", response_model=APIResponse[dict])
async def change_membership(
    user_id: uuid.UUID,
    payload: MembershipChange,
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Staff-recorded membership changes for offline payments.

      grant   — start a paid (or complimentary) term for a member with no
                active subscription. Creates the same Subscription row shape a
                PayPal capture does (gateway = manual) and sets the access tier.
      extend  — push the end date of the current term out. With an amount it is
                recorded as a paid renewal (a new row; the old one is closed as
                expired so revenue history stays intact).
      change  — move the member to a different plan (new row, old one closed).
                A downgrade needs confirm=true.
      end     — remove paid access now (tier → free). Needs confirm=true.
                refunded=true marks the rows cancelled (as a PayPal refund does)
                so the revenue leaves the dashboard; otherwise they're expired.

    Always requires a reason and writes a `membership.<action>` audit row.
    """
    from app.routers.subscriptions import PLAN_FEATURE_MAP, PLAN_TERM_DAYS, PLAN_TIER_MAP

    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    u, p = await _load_member(db, tenant_uuid, user_id)
    if u.deleted_at is not None:
        raise HTTPException(status_code=409, detail="This account is deleted. Restore it before changing its membership.")

    action = payload.action
    now = datetime.utcnow()  # naive UTC, to match the subscription columns
    active = await _active_subscriptions(db, tenant_uuid, u.id)
    cur = active[0] if active else None
    cur_lapsed = bool(cur and cur.current_period_end and cur.current_period_end < now)
    tier_before = normalize_plan(_ev(u.subscription_tier))
    admin_email = (current_user.get("email") or None)
    stamp = now.isoformat() + "Z"

    def _event(kind: str, **kw: Any) -> dict[str, Any]:
        return {"type": kind, "at": stamp, "by": admin_email, "reason": payload.reason, **kw}

    def _close(rows: list[Subscription], status_: SubscriptionStatus, kind: str, **kw: Any) -> None:
        for s in rows:
            s.status = status_
            s.cancelled_at = now if status_ == SubscriptionStatus.CANCELLED else s.cancelled_at
            _append_event(s, _event(kind), **kw)

    def _new_row(plan: str, period_end: datetime, amount: int, currency: str, kind: str) -> Subscription:
        feat = PLAN_FEATURE_MAP.get(plan, {})
        return Subscription(
            id=uuid.uuid4(),
            tenant_id=tenant_uuid,
            user_id=u.id,
            plan=plan,
            status=SubscriptionStatus.ACTIVE,
            gateway=PaymentGateway.MANUAL,
            gateway_subscription_id=f"manual-{uuid.uuid4().hex[:16]}",
            amount_paise=int(amount),
            currency=currency,
            current_period_start=now,
            current_period_end=period_end,
            monthly_interests=feat.get("interests", 10),
            monthly_contacts=feat.get("contacts", 0),
            monthly_video_calls=feat.get("video_calls", 0),
            raw_webhook_data={
                "source": "admin",
                "kind": kind,
                "admin_id": str(current_user.get("sub") or ""),
                "admin_email": admin_email,
                "reason": payload.reason,
                "payment_method": payload.payment_method,
                "payment_reference": payload.payment_reference,
                "recorded_at": stamp,
            },
        )

    def _require_payment_details() -> int:
        if payload.payment_method is None:
            raise HTTPException(status_code=422, detail="Choose how the member paid (or Complimentary).")
        if payload.payment_method == "complimentary":
            if payload.amount_pence:
                raise HTTPException(status_code=422, detail="A complimentary membership can't carry an amount.")
            return 0
        if payload.amount_pence is None or payload.amount_pence <= 0:
            raise HTTPException(status_code=422, detail="Enter the amount the member paid, or choose Complimentary.")
        return int(payload.amount_pence)

    catalog = {c["plan"]: c for c in await _plan_catalog(db, tenant_uuid)}
    details: dict[str, Any] = {"plan_from": tier_before}
    notify: tuple[str, str, str] | None = None  # (type, title, body)
    new_sub: Subscription | None = None

    if action == "grant":
        if payload.plan is None:
            raise HTTPException(status_code=422, detail="Choose a plan to grant.")
        if cur is not None and not cur_lapsed:
            raise HTTPException(
                status_code=409,
                detail=f"This member already has an active {PLAN_LABELS[normalize_plan(cur.plan)]} membership. Use Extend or Change plan instead.",
            )
        amount = _require_payment_details()
        period_end = _resolve_period_end(payload, base=now, default_days=PLAN_TERM_DAYS.get(payload.plan, 180))
        if period_end <= now:
            raise HTTPException(status_code=422, detail="The end date must be in the future.")
        if period_end > now + timedelta(days=_MAX_TERM_DAYS):
            raise HTTPException(status_code=422, detail="A single term can't be longer than 3 years.")
        # Any lapsed-but-still-"active" rows are closed truthfully first.
        new_sub = _new_row(payload.plan, period_end, amount, catalog[payload.plan]["currency"], "grant")
        await _insert_manual_subscription(db, new_sub)
        _close(active, SubscriptionStatus.EXPIRED, "superseded", superseded_by=str(new_sub.id))
        u.subscription_tier = PLAN_TIER_MAP[payload.plan]
        details.update(plan_to=payload.plan, period_end=period_end.date().isoformat(), amount_pence=amount)
        label = PLAN_LABELS[payload.plan]
        notify = ("subscription_activated", f"Welcome to {label}",
                  f"Your {label} membership is now active until {period_end.strftime('%d %B %Y')}.")

    elif action == "extend":
        if cur is None:
            raise HTTPException(status_code=409, detail="There's no active membership to extend. Use Grant instead.")
        if payload.plan is not None and payload.plan != normalize_plan(cur.plan):
            raise HTTPException(status_code=422, detail="Extend keeps the same plan. Use Change plan to switch.")
        base = max(cur.current_period_end or now, now)
        period_end = _resolve_period_end(payload, base=base, default_days=None)
        if period_end <= (cur.current_period_end or now) or period_end <= now:
            raise HTTPException(status_code=422, detail="The new end date must be later than the current one. To shorten access, end the membership.")
        if period_end > now + timedelta(days=_MAX_TERM_DAYS):
            raise HTTPException(status_code=422, detail="A membership can't run more than 3 years ahead.")
        plan = normalize_plan(cur.plan)
        paid = bool(payload.amount_pence) or payload.payment_method not in (None, "complimentary")
        details.update(plan_to=plan, period_end_from=_iso(cur.current_period_end), period_end=period_end.date().isoformat())
        if paid:
            amount = _require_payment_details()
            new_sub = _new_row(plan, period_end, amount, cur.currency or "GBP", "renewal")
            await _insert_manual_subscription(db, new_sub)
            _close(active, SubscriptionStatus.EXPIRED, "superseded", superseded_by=str(new_sub.id))
            details.update(amount_pence=amount, renewal=True)
        else:
            _append_event(cur, _event("extend", period_end_from=_iso(cur.current_period_end), period_end_to=period_end.isoformat()))
            cur.current_period_end = period_end
        if plan in PLAN_TIER_MAP and tier_before != plan:
            u.subscription_tier = PLAN_TIER_MAP[plan]  # heal a tier/row mismatch
        notify = ("system", "Your membership has been extended",
                  f"Your {PLAN_LABELS[plan]} membership now runs until {period_end.strftime('%d %B %Y')}.")

    elif action == "change":
        if payload.plan is None:
            raise HTTPException(status_code=422, detail="Choose the plan to move this member to.")
        cur_plan = normalize_plan(cur.plan) if cur is not None else tier_before
        if payload.plan == cur_plan and payload.plan == tier_before:
            raise HTTPException(status_code=409, detail=f"This member is already on {PLAN_LABELS[payload.plan]}.")
        downgrade = PLAN_RANK[payload.plan] < PLAN_RANK[tier_before]
        if downgrade and not payload.confirm:
            raise HTTPException(status_code=409, detail={
                "code": "confirm_required",
                "message": f"Moving from {PLAN_LABELS[tier_before]} to {PLAN_LABELS[payload.plan]} removes features. Confirm to continue.",
            })
        if payload.period_end is None and payload.days is None and cur is not None and not cur_lapsed:
            period_end = cur.current_period_end  # keep the time already paid for
        else:
            period_end = _resolve_period_end(payload, base=now, default_days=PLAN_TERM_DAYS.get(payload.plan, 180))
        if period_end <= now:
            raise HTTPException(status_code=422, detail="The end date must be in the future.")
        if period_end > now + timedelta(days=_MAX_TERM_DAYS):
            raise HTTPException(status_code=422, detail="A single term can't be longer than 3 years.")
        if payload.payment_method == "complimentary" and payload.amount_pence:
            raise HTTPException(status_code=422, detail="A complimentary change can't carry an amount.")
        if payload.amount_pence and payload.payment_method is None:
            raise HTTPException(status_code=422, detail="Choose how the member paid the difference.")
        amount = int(payload.amount_pence or 0)
        new_sub = _new_row(payload.plan, period_end, amount, catalog[payload.plan]["currency"], "plan_change")
        await _insert_manual_subscription(db, new_sub)
        _close(active, SubscriptionStatus.EXPIRED, "superseded", superseded_by=str(new_sub.id))
        u.subscription_tier = PLAN_TIER_MAP[payload.plan]
        details.update(plan_to=payload.plan, period_end=period_end.date().isoformat(), amount_pence=amount, downgrade=downgrade)
        label = PLAN_LABELS[payload.plan]
        notify = ("subscription_activated", f"You're now on {label}",
                  f"Your membership has been changed to {label}, running until {period_end.strftime('%d %B %Y')}.")

    else:  # end
        if cur is None and tier_before == "free":
            raise HTTPException(status_code=409, detail="This member has no paid membership to end.")
        if not payload.confirm:
            raise HTTPException(status_code=409, detail={
                "code": "confirm_required",
                "message": f"Ending the membership removes {PLAN_LABELS[tier_before]} access immediately. Confirm to continue.",
            })
        _close(active, SubscriptionStatus.CANCELLED if payload.refunded else SubscriptionStatus.EXPIRED,
               "ended", ended_by_admin=True, refunded=bool(payload.refunded))
        for s in active:
            s.cancelled_at = now
        u.subscription_tier = SubscriptionTier.FREE
        details.update(plan_to="free", refunded=bool(payload.refunded), subscriptions_closed=len(active))
        notify = ("system", "Your membership has ended",
                  f"Your {PLAN_LABELS[tier_before]} membership has ended. You can renew at any time.")

    await db.flush()

    if payload.payment_method:
        details["payment_method"] = payload.payment_method
    if payload.payment_reference:
        details["payment_reference"] = payload.payment_reference
    if new_sub is not None:
        details["subscription_id"] = str(new_sub.id)

    if payload.notify_member and notify is not None:
        try:
            async with db.begin_nested():
                n = await create_notification(
                    user_id=u.id, tenant_id=tenant_uuid, type=notify[0], title=notify[1], body=notify[2],
                    action_url="/subscription", db=db,
                )
                n.extra_data = {"source": "admin", "action": f"membership.{action}"}
                await db.flush()
            details["member_notified"] = True
        except Exception as exc:  # the change itself must not fail on this
            logger.warning("membership_notify_failed", error=str(exc))

    await record_admin_action(
        db, current_user, f"membership.{action}", tenant_id=tenant_uuid,
        target_type="user", target_id=u.id, target_label=_label(u, p),
        summary=payload.reason, details=details,
    )
    logger.info("admin_membership_change", admin=current_user.get("sub"), target=str(u.id), action=action)

    active_after = await _active_subscriptions(db, tenant_uuid, u.id)
    return APIResponse(
        success=True,
        data={**_membership_state(u, active_after), "action": action},
        message="Membership updated.",
    )


# ─── Edit a profile on the member's behalf ───────────────────────────────────
#
# A deliberately small, low-risk subset: identity basics, location and
# education/career. NOT editable here: religion / caste / horoscope (special-
# category data the member gave under their own explicit consent), the bio and
# family text (the member's own words), photos, partner preferences, contact
# details and anything to do with verification or membership.

_GENDERS = [g.value for g in Gender]
_MARITAL = [m.value for m in MaritalStatus]


class AdminProfileChanges(BaseModel):
    """Same field types as the member's own ProfileUpdate, plus the column
    lengths, so a bad value is a 422 here rather than a database error."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    date_of_birth: date | None = None
    gender: Gender | None = None
    marital_status: MaritalStatus | None = None
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, min_length=2, max_length=100)
    pincode: str | None = Field(default=None, max_length=10)
    mother_tongue: str | None = Field(default=None, max_length=100)
    height_cm: int | None = Field(default=None, ge=90, le=250)
    education_level: str | None = Field(default=None, max_length=100)
    education_field: str | None = Field(default=None, max_length=200)
    college: str | None = Field(default=None, max_length=200)
    occupation: str | None = Field(default=None, max_length=200)
    employer: str | None = Field(default=None, max_length=200)


EDITABLE_FIELDS: list[dict[str, Any]] = [
    {"key": "first_name", "label": "First name", "type": "text", "group": "Identity", "required": True, "max": 100},
    {"key": "last_name", "label": "Last name", "type": "text", "group": "Identity", "max": 100},
    {"key": "date_of_birth", "label": "Date of birth", "type": "date", "group": "Identity"},
    {"key": "gender", "label": "Gender", "type": "select", "group": "Identity", "options": _GENDERS},
    {"key": "marital_status", "label": "Marital status", "type": "select", "group": "Identity", "options": _MARITAL},
    {"key": "height_cm", "label": "Height (cm)", "type": "number", "group": "Identity", "min": 90, "max": 250},
    {"key": "mother_tongue", "label": "Mother tongue", "type": "text", "group": "Identity", "max": 100},
    {"key": "city", "label": "City", "type": "text", "group": "Location", "max": 100},
    {"key": "state", "label": "County / state", "type": "text", "group": "Location", "max": 100},
    {"key": "country", "label": "Country", "type": "text", "group": "Location", "required": True, "max": 100},
    {"key": "pincode", "label": "Postcode", "type": "text", "group": "Location", "max": 10},
    {"key": "education_level", "label": "Education", "type": "text", "group": "Education & career", "max": 100},
    {"key": "education_field", "label": "Field of study", "type": "text", "group": "Education & career", "max": 200},
    {"key": "college", "label": "College / university", "type": "text", "group": "Education & career", "max": 200},
    {"key": "occupation", "label": "Occupation", "type": "text", "group": "Education & career", "max": 200},
    {"key": "employer", "label": "Employer", "type": "text", "group": "Education & career", "max": 200},
]
_EDITABLE_KEYS = [f["key"] for f in EDITABLE_FIELDS]
# NOT NULL columns (or fields the onboarding gate requires) can't be blanked.
_NOT_CLEARABLE = {"first_name", "country", "date_of_birth", "gender"}


class AdminProfileEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    changes: AdminProfileChanges
    reason: str = Field(min_length=1, max_length=500)
    notify_member: bool = True

    @field_validator("reason")
    @classmethod
    def _reason(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 5:
            raise ValueError("Give a reason of at least 5 characters — it goes in the audit log.")
        return v


def _plain(v: Any) -> Any:
    v = _ev(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    return v


@router.get("/{user_id}/profile", response_model=APIResponse[dict])
async def get_editable_profile(
    user_id: uuid.UUID,
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    u, p = await _load_member(db, tenant_uuid, user_id)
    return APIResponse(success=True, data={
        "has_profile": p is not None,
        "is_deleted": u.deleted_at is not None,
        "version": int(p.version or 0) if p else 0,
        "fields": EDITABLE_FIELDS,
        "values": {k: _plain(getattr(p, k, None)) for k in _EDITABLE_KEYS} if p else {},
        "not_editable_note": (
            "Religion, community and horoscope details, the member's own bio and family text, photos, "
            "partner preferences and contact details can only be changed by the member."
        ),
    })


@router.patch("/{user_id}/profile", response_model=APIResponse[dict])
async def edit_profile_on_behalf(
    user_id: uuid.UUID,
    payload: AdminProfileEdit,
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Correct a typo / wrong city etc. for a member. Only the fields in
    AdminProfileChanges can be sent (anything else is a 422); the 18+ rule is
    the same one the member's own PATCH applies. Writes `profile.admin_edit`
    with a before → after diff and the admin's reason."""
    from app.routers.profile import validate_dob_change

    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    u, p = await _load_member(db, tenant_uuid, user_id)
    if u.deleted_at is not None:
        raise HTTPException(status_code=409, detail="This account is deleted — its profile can't be edited.")
    if p is None or p.deleted_at is not None:
        raise HTTPException(status_code=409, detail="This member hasn't created a profile yet, so there's nothing to edit.")

    incoming = payload.changes.model_dump(exclude_unset=True)
    if not incoming:
        raise HTTPException(status_code=422, detail="No changes were sent.")

    diff: dict[str, str] = {}
    for key, value in incoming.items():
        if isinstance(value, str) and value == "":
            value = None
        if value is None and key in _NOT_CLEARABLE:
            raise HTTPException(status_code=422, detail=f"{key.replace('_', ' ').capitalize()} can't be left blank.")
        before = getattr(p, key, None)
        if _plain(before) == _plain(value):
            continue
        if key == "date_of_birth":
            validate_dob_change(
                value, before,
                under_age_detail="Members must be at least 18 years old — that date of birth isn't allowed.",
                too_old_detail="Please check the date of birth.",
            )
        setattr(p, key, value)
        diff[key] = f"{_plain(before) if before not in (None, '') else '—'} → {_plain(value) if value is not None else '—'}"

    if not diff:
        return APIResponse(success=True, data={"changed": [], "version": int(p.version or 0)}, message="Nothing to change — the profile already has those values.")

    p.completeness_score = compute_profile_completeness(p)
    p.version = int(p.version or 0) + 1
    await db.flush()

    notified = False
    if payload.notify_member:
        try:
            labels = {f["key"]: f["label"].lower() for f in EDITABLE_FIELDS}
            changed_txt = ", ".join(labels.get(k, k) for k in diff)
            async with db.begin_nested():
                n = await create_notification(
                    user_id=u.id, tenant_id=tenant_uuid, type="system",
                    title="We updated your profile",
                    body=f"Our team corrected the following on your profile: {changed_txt}. If anything looks wrong, you can change it in your profile or contact us.",
                    action_url="/profile/me", db=db,
                )
                n.extra_data = {"source": "admin", "action": "profile.admin_edit", "fields": list(diff)}
                await db.flush()
            notified = True
        except Exception as exc:
            logger.warning("profile_edit_notify_failed", error=str(exc))

    await record_admin_action(
        db, current_user, "profile.admin_edit", tenant_id=tenant_uuid,
        target_type="user", target_id=u.id, target_label=_label(u, p),
        summary=payload.reason,
        details={"fields": list(diff), "changes": diff, "member_notified": notified},
    )
    logger.info("admin_profile_edit", admin=current_user.get("sub"), target=str(u.id), fields=list(diff))

    return APIResponse(
        success=True,
        data={
            "changed": list(diff),
            "version": int(p.version or 0),
            "completeness_score": int(p.completeness_score or 0),
            "values": {k: _plain(getattr(p, k, None)) for k in _EDITABLE_KEYS},
            "member_notified": notified,
        },
        message="Profile updated.",
    )
