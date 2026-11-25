"""
UserConsent — append-only record of every consent a member gives or withdraws
(UK GDPR Art. 7(1): the controller must be able to demonstrate consent).

One row per decision. The member's *current* state for a consent type is the
latest row for (user_id, consent_type). Rows are never updated in place, so the
table doubles as the audit trail.

consent_type values (see app.routers.consents.CONSENT_TYPES):
  terms_privacy       — accepted the Terms of Service + Privacy Policy
  sensitive_data      — explicit consent (Art. 9(2)(a)) to process religion,
                        community/caste and horoscope details for matchmaking
  marketing_email     — opted in to "News & offers" emails (PECR)

The user_id FK cascades on delete so the "discard incomplete signup" flow,
which hard-deletes the users row, keeps working.
"""
import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class UserConsent(TenantModel):
    __tablename__ = "user_consents"
    __table_args__ = (
        Index("ix_user_consents_user_type_created", "user_id", "consent_type", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    consent_type: Mapped[str] = mapped_column(String(40), nullable=False)
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    # Version of the policy text the member saw (e.g. "2026-11-25").
    policy_version: Mapped[str] = mapped_column(String(20), nullable=False)
    # Where it was given: "signup", "reconsent_prompt", "settings".
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
