"""
PricingPlan — admin-managed subscription tiers.

Drives the public pricing page and the subscription checkout flow. Each row is
a sellable plan with its price, period, and feature bullets. Plans can be
toggled inactive without being deleted (status preserved for audit).
"""
import enum
import uuid

from sqlalchemy import BigInteger, Boolean, Enum, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class PricingPeriod(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
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
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")

    period: Mapped[PricingPeriod] = mapped_column(
        Enum(PricingPeriod), nullable=False, default=PricingPeriod.MONTHLY
    )

    # Bullet points shown on the marketing card. Stored as JSON list of strings.
    features: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Lower numbers display first. We default to 100 so newly created rows land
    # at the end without colliding with existing rows.
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
