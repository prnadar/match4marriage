"""
SuccessStory — admin-managed CMS table for the public Success Stories page.

Public surface: GET /api/v1/public/success-stories returns active, published
stories ordered by sort_order. Admin manages via /api/v1/admin/success-stories.

Each story records:
  - the couple's first names + city
  - the year they married
  - a short headline + longer body (already-edited copy)
  - a photo key (S3/Cloudinary) — optional
  - publish state (is_published) and ordering (sort_order)
  - consent_signed_at — required to publish (legal/PR safety: never publish a
    story without recorded consent)

Soft-deleted via deleted_at; admin can unpublish without deleting.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class SuccessStory(TenantModel):
    __tablename__ = "success_stories"

    # Couple identity (display only — no FK to users by design; some couples may
    # have left the platform, others may have joined externally and given
    # consent for marketing).
    couple_names: Mapped[str] = mapped_column(String(160), nullable=False)
    location:     Mapped[str | None] = mapped_column(String(160), nullable=True)
    year_married: Mapped[int]        = mapped_column(Integer, nullable=False)

    # Editorial copy
    headline: Mapped[str]        = mapped_column(String(220), nullable=False)
    body:     Mapped[str]        = mapped_column(Text, nullable=False)
    quote:    Mapped[str | None] = mapped_column(Text, nullable=True)

    # Media (image stored in S3/Cloudinary; public URL constructed at read time)
    photo_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(900), nullable=True)

    # Publish controls
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    sort_order:   Mapped[int]  = mapped_column(Integer, nullable=False, default=0)

    # Required for legal/PR safety — admin enforces this before set_published(True)
    consent_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Optional admin metadata
    submitted_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
