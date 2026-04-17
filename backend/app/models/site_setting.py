"""
SiteSetting — per-tenant global configuration (single row).

One row per tenant; uniqueness is enforced by tenant_id. Future PRs add
appearance / payment-gateway columns to this same row (or sibling tables
if the data outgrows a single row).
"""
import uuid

from sqlalchemy import JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class SiteSetting(TenantModel):
    __tablename__ = "site_settings"
    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_site_settings_tenant"),
    )

    site_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    tagline: Mapped[str | None] = mapped_column(String(200), nullable=True)
    support_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    support_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Kolkata")
    default_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    default_locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    # Appearance — logo + brand colors used by the public theme.
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    favicon_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    brand_primary: Mapped[str | None] = mapped_column(String(9), nullable=True)
    brand_accent: Mapped[str | None] = mapped_column(String(9), nullable=True)
    # Catch-all for forward-compatible flags (e.g. feature toggles) so we don't
    # need a migration every time a small setting is added.
    extras: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
