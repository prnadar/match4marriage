"""
PricingPlan — admin-managed subscription tiers.

Drives the public pricing page and the subscription checkout flow. Each row is
a sellable plan with its price, period, and feature bullets. Plans can be
toggled inactive without being deleted (status preserved for audit).
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, Enum, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class PricingPeriod(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"      # 3 months
    HALF_YEARLY = "half_yearly"  # 6 months
    YEARLY = "yearly"


class PricingPlan(TenantModel):
    __tablename__ = "pricing_plans"
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_pricing_plans_tenant_key"),
    )

    # Stable handle (e.g. "gold-monthly"); used by checkout to look up the plan.
    key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Display name shown on the pricing page (e.g. "Gold").
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    # Tier maps to users.subscription_tier (silver | gold | platinum).
    tier: Mapped[str] = mapped_column(String(32), nullable=False)

    price_paise: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    # Optional "was" price. When set and greater than price_paise, the UI
    # shows it struck through next to the live price (promo / inaugural offer).
    original_price_paise: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="GBP")
    # When the promo (price_paise below original_price_paise) ends. Naive UTC.
    # After this moment the plan sells at original_price_paise again — on the
    # cards AND at checkout — with no manual revert needed. Null = no end date.
    offer_ends_at: Mapped[datetime | None] = mapped_column(nullable=True)

    period: Mapped[PricingPeriod] = mapped_column(
        Enum(PricingPeriod), nullable=False, default=PricingPeriod.MONTHLY
    )

    # Bullet points shown on the marketing card. Stored as JSON list of strings.
    features: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Lower numbers display first. We default to 100 so newly created rows land
    # at the end without colliding with existing rows.
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=100)


def effective_pricing(plan: "PricingPlan", now: datetime | None = None) -> tuple[int, int | None, datetime | None]:
    """(price, was_price, offer_ends_at) as members should see and pay it now.

    A promo is `original_price_paise > price_paise`. Once `offer_ends_at` has
    passed, the regular (original) price applies and the promo disappears.
    """
    price = int(plan.price_paise or 0)
    was = int(plan.original_price_paise) if plan.original_price_paise is not None else None
    ends = plan.offer_ends_at
    if was is None or was <= price:
        return price, None, None
    if ends is not None:
        now = now or datetime.now(timezone.utc).replace(tzinfo=None)
        if now >= ends:
            return was, None, None
    return price, was, ends
