"""
Membership expiry.

Paid access is governed by `users.subscription_tier`; the subscription row
holds the term (`current_period_end`). Nothing used to move a member back to
Basic when the term ran out, so a 6-month Premium membership never ended.

`expire_lapsed()` closes the gap. It is called:
- lazily for the signed-in member (entitlement checks, /auth/me,
  /subscriptions/limits), so access ends the moment they next use the site;
- daily for everyone by the Vercel cron (`/internal/cron/expire-memberships`),
  so admin views and plan counts stay truthful too.

Deliberately conservative: a member is downgraded only when they have at least
one ACTIVE subscription row and every one of them has an end date in the past.
A paid tier with no subscription row at all (legacy/manual data) is left alone
rather than guessed at.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.notification import Notification
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import SubscriptionTier, User

logger = get_logger(__name__)

_PLAN_LABEL = {"silver": "Basic", "gold": "Premium", "platinum": "Elite"}


async def expire_lapsed(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> int:
    """Downgrade members whose paid term has ended. Returns how many.

    `now` is naive UTC (subscription period columns are TIMESTAMP WITHOUT TZ).
    The caller owns the transaction.
    """
    now = now or datetime.utcnow()

    q = (
        select(Subscription, User)
        .join(User, User.id == Subscription.user_id)
        .where(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.deleted_at.is_(None),
            User.subscription_tier != SubscriptionTier.FREE,
            User.deleted_at.is_(None),
        )
    )
    if user_id is not None:
        q = q.where(Subscription.user_id == user_id)

    by_user: dict[uuid.UUID, tuple[User, list[Subscription]]] = {}
    for sub, user in (await db.execute(q)).all():
        by_user.setdefault(user.id, (user, []))[1].append(sub)

    expired = 0
    for user, subs in by_user.values():
        # Still covered by any active term (or an open-ended one)? Keep access.
        if any(s.current_period_end is None or s.current_period_end > now for s in subs):
            continue

        tier = getattr(user.subscription_tier, "value", user.subscription_tier)
        label = _PLAN_LABEL.get(str(tier).lower(), "paid")
        ended_on = max(s.current_period_end for s in subs)

        for s in subs:
            s.status = SubscriptionStatus.EXPIRED
            raw = dict(s.raw_webhook_data) if isinstance(s.raw_webhook_data, dict) else {}
            events = [e for e in (raw.get("admin_events") or []) if isinstance(e, dict)]
            events.append({"type": "term_ended", "at": now.isoformat() + "Z", "by": "system"})
            raw["admin_events"] = events[-50:]
            s.raw_webhook_data = raw  # new dict so the JSON change persists

        user.subscription_tier = SubscriptionTier.FREE
        db.add(Notification(
            tenant_id=user.tenant_id,
            user_id=user.id,
            type="system",
            title=f"Your {label} membership has ended",
            body=(
                f"Your {label} membership ended on {ended_on.strftime('%d %B %Y')}. "
                "Renew any time to keep unlimited interests and messaging."
            ),
            action_url="/subscription",
            extra_data={"plan_from": str(tier).lower(), "ended_on": ended_on.date().isoformat()},
        ))
        expired += 1
        logger.info("membership_expired", user_id=str(user.id), plan=str(tier).lower(),
                    ended_on=ended_on.isoformat())

    if expired:
        await db.flush()
    return expired


async def expire_if_lapsed(db: AsyncSession, user_id: uuid.UUID | str | None) -> None:
    """Best-effort lazy expiry for one member. Never raises: a failure here
    must not break the request that triggered it (SAVEPOINT keeps the outer
    transaction usable)."""
    if not user_id:
        return
    try:
        uid = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return
    try:
        async with db.begin_nested():
            await expire_lapsed(db, user_id=uid)
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("membership_expiry_check_failed", user_id=str(uid), error=str(e))
