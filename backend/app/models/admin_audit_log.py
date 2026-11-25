"""
Admin audit log.

One row per consequential admin action (approve/reject a profile, suspend a
member, change pricing, edit site settings, grant admin, introduce two
members, ...). Append-only: rows are never updated by the app. Tenant-scoped
like every other table.

`action` is a dotted verb, e.g. "verification.approve", "user.suspend",
"pricing.update", "settings.site.update", "admin.grant", "match.introduce".
`target_*` identifies what was acted on; `details` carries a small JSON diff or
context (never secrets).
"""
import uuid
from typing import Any

from sqlalchemy import JSON, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class AdminAuditLog(TenantModel):
    __tablename__ = "admin_audit_logs"
    __table_args__ = (
        Index("ix_admin_audit_logs_tenant_created", "tenant_id", "created_at"),
    )

    # DB user id of the admin (current_user["sub"]); nullable because some
    # admins exist only in Firebase.
    actor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), nullable=True, index=True)
    actor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    target_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    target_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
