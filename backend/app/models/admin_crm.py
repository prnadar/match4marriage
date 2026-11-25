"""
Admin CRM models — how the bureau keeps in touch with its members.

  AdminCommunication  one row per admin → member contact (email, in-app
                      message, or a manually logged call / WhatsApp / SMS).
                      This is the communication log shown on the user
                      timeline and on /admin/communications.
  AdminBroadcast      one row per bulk send (selection or segment). Each
                      recipient also gets an AdminCommunication row linked
                      back via ``broadcast_id``.
  AdminUserNote       internal staff notes on a member (never shown to them).
  UserCrmProfile      per-member CRM state: tags ("VIP", "Follow up"...),
                      follow-up date + note. One row per (tenant, user).

All tables are tenant-scoped through TenantModel and created at boot by
``Base.metadata.create_all`` (see ``_ensure_crm_tables`` in app/main.py).
None of them alter the ``users`` table, so adding them never takes a lock
on a hot table.
"""
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel

# JSONB on Postgres (so tags support `@>` containment filters), plain JSON
# elsewhere (SQLite in tests).
_JSONB = JSON().with_variant(JSONB(), "postgresql")


class CommunicationChannel:
    EMAIL = "email"
    IN_APP = "in_app"
    # Manually logged contacts made outside the platform.
    CALL = "call"
    WHATSAPP = "whatsapp"
    SMS = "sms"
    MEETING = "meeting"
    OTHER = "other"

    SENDABLE = (EMAIL, IN_APP)
    LOGGABLE = (CALL, WHATSAPP, SMS, MEETING, EMAIL, OTHER)
    ALL = (EMAIL, IN_APP, CALL, WHATSAPP, SMS, MEETING, OTHER)


class CommunicationStatus:
    SENT = "sent"          # delivered to provider / inserted in-app
    FAILED = "failed"      # provider error, missing address, etc.
    SKIPPED = "skipped"    # e.g. broadcast email to a user with no email
    LOGGED = "logged"      # manual log of an off-platform contact


class AdminCommunication(TenantModel):
    __tablename__ = "admin_communications"
    __table_args__ = (
        Index("ix_admin_comms_tenant_user_created", "tenant_id", "user_id", "created_at"),
        Index("ix_admin_comms_tenant_created", "tenant_id", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    admin_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), nullable=True)
    admin_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    channel: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(10), nullable=False, default="outbound")
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Recipient address actually used (email / phone) — snapshot at send time.
    to_address: Mapped[str | None] = mapped_column(String(255), nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default=CommunicationStatus.SENT)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    template_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    broadcast_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), nullable=True, index=True)
    # Free-form: call outcome, notification id, etc. ("metadata" is reserved.)
    meta: Mapped[dict[str, Any]] = mapped_column(_JSONB, nullable=False, default=dict)

    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AdminBroadcast(TenantModel):
    __tablename__ = "admin_broadcasts"

    admin_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), nullable=True)
    admin_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    channels: Mapped[list[str]] = mapped_column(_JSONB, nullable=False, default=list)
    # {"type": "users", "user_ids": [...]} or {"type": "segment", "segment": "...", "value": "..."}
    audience: Mapped[dict[str, Any]] = mapped_column(_JSONB, nullable=False, default=dict)
    audience_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    template_key: Mapped[str | None] = mapped_column(String(64), nullable=True)

    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # sending | completed | partial | failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="sending")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AdminUserNote(TenantModel):
    __tablename__ = "admin_user_notes"
    __table_args__ = (
        Index("ix_admin_user_notes_tenant_user", "tenant_id", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    admin_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), nullable=True)
    admin_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class UserCrmProfile(TenantModel):
    __tablename__ = "user_crm_profiles"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", name="uq_user_crm_profiles_tenant_user"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tags: Mapped[list[str]] = mapped_column(_JSONB, nullable=False, default=list)
    follow_up_at: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    follow_up_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
