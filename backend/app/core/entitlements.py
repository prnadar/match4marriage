"""Subscription entitlements — the single source of truth for what each
tier can do in software.

Tier ↔ marketing-plan mapping (mirrors the pricing page and the member app):

    users.subscription_tier   Plan name on /pricing
    ───────────────────────   ─────────────────────
    free                      Basic        (£0 / 3 months)
    silver                    Premium      (£300 / 6 months)
    gold                      Elite        (£1,000 / 6 months)
    platinum                  VIP Concierge (bespoke)

(Note: the legacy `PLAN_DISPLAY` map in routers/subscriptions.py uses a
different, older naming — do not rely on it for gating. Gate on the raw
tier strings via the helpers here.)

Only the *core* software gates are enforced today: direct messaging, photo
access, unlimited expressions of interest, and advanced search filters.
Concierge rows in the pricing matrix (matchmaker, legal/visa, due diligence,
etc.) are delivered manually and are not gated here.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # avoid runtime import cycles
    from sqlalchemy.ext.asyncio import AsyncSession

# Ordered tiers — higher rank inherits everything below it.
PLAN_RANK: dict[str, int] = {"free": 0, "silver": 1, "gold": 2, "platinum": 3}

# Premium (silver) is the first paid tier; the core gates unlock there.
_PAID_FROM = PLAN_RANK["silver"]

# Basic (free) cap on expressions of interest; paid tiers are unlimited.
FREE_INTEREST_LIMIT = 10

# Browse filters that require Premium+. Standard filters (age, religion,
# location) stay available to everyone.
ADVANCED_BROWSE_FILTERS = ("education", "marital_status", "has_photo")


def normalize_plan(plan: str | None) -> str:
    p = (plan or "free").lower()
    return p if p in PLAN_RANK else "free"


def _rank(plan: str | None) -> int:
    return PLAN_RANK[normalize_plan(plan)]


def can_message(plan: str | None) -> bool:
    """Direct messaging — Premium and above."""
    return _rank(plan) >= _PAID_FROM


def can_view_photos(plan: str | None) -> bool:
    """Viewing other members' *main* photos — available to everyone, including
    Basic. (Kept as a helper for the limits payload; always True.)"""
    return True


def can_view_premium_photos(plan: str | None) -> bool:
    """Viewing photos a member has marked **Premium** — Premium tier and above
    (silver/gold/platinum). Basic (free) members see locked placeholders."""
    return _rank(plan) >= _PAID_FROM


def can_use_advanced_filters(plan: str | None) -> bool:
    """Advanced search filters — Premium and above."""
    return _rank(plan) >= _PAID_FROM


def interest_limit(plan: str | None) -> int | None:
    """Max expressions of interest a member may send. None = unlimited."""
    return None if _rank(plan) >= _PAID_FROM else FREE_INTEREST_LIMIT


async def get_user_plan(db: "AsyncSession", user_id: uuid.UUID | str | None) -> str:
    """Resolve a user's subscription tier string ('free'|'silver'|'gold'|
    'platinum'). Falls back to 'free' on any lookup failure so gating fails
    closed (least privilege)."""
    if user_id is None:
        return "free"
    try:
        from sqlalchemy import select
        from app.models.user import User

        uid = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
        row = (
            await db.execute(select(User.subscription_tier).where(User.id == uid))
        ).scalar_one_or_none()
        return normalize_plan(row.value if row else "free")
    except Exception:
        return "free"
