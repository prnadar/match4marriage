"""
Enquiry — leads from public surfaces (contact form, landing CTA, profile-interest).

Stored in the `enquiries` table. Admin sees them in /admin/enquiries.
Public submission is unauthenticated; admin actions are admin-only.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class EnquirySource(str, enum.Enum):
    CONTACT_FORM = "contact_form"
    LANDING = "landing"
    PROFILE_INTEREST = "profile_interest"
    OTHER = "other"


class EnquiryStatus(str, enum.Enum):
    NEW = "new"
    IN_REVIEW = "in_review"
    RESPONDED = "responded"
    CLOSED = "closed"


class Enquiry(TenantModel):
    __tablename__ = "enquiries"

    source: Mapped[EnquirySource] = mapped_column(
        Enum(EnquirySource), nullable=False, default=EnquirySource.CONTACT_FORM, index=True,
    )
    status: Mapped[EnquiryStatus] = mapped_column(
        Enum(EnquiryStatus), nullable=False, default=EnquiryStatus.NEW, index=True,
    )

    # Submitter contact info — all optional except name (some forms only ask for one channel).
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)

    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Admin who picked this up. Optional — defaults to unassigned.
    assigned_admin_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)
