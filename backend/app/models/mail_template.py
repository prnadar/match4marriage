"""
MailTemplate — admin-managed transactional email templates.

The `key` is the stable handle code uses to look up the template (e.g. "welcome").
Each tenant has at most one row per key. Body is HTML; a plaintext version is
optional (auto-derived if omitted at send time).
"""
import uuid

from sqlalchemy import Boolean, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class MailTemplate(TenantModel):
    __tablename__ = "mail_templates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_mail_templates_tenant_key"),
    )

    key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    body_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
