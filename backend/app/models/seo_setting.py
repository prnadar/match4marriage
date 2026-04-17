"""
SeoSetting — per-path meta tags and Open Graph data.

`path` is the public URL path (e.g. "/", "/pricing", "/about"). Each tenant
has at most one row per path. Used by the public site to render <head>.
"""
from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class SeoSetting(TenantModel):
    __tablename__ = "seo_settings"
    __table_args__ = (
        UniqueConstraint("tenant_id", "path", name="uq_seo_settings_tenant_path"),
    )

    path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    og_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Robots directive — e.g. "index, follow" or "noindex, nofollow".
    robots: Mapped[str] = mapped_column(String(100), nullable=False, default="index, follow")
