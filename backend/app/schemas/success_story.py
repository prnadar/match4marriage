"""Pydantic schemas for the success_stories CMS table."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SuccessStoryRead(BaseModel):
    """Public-safe read shape (no admin notes, no consent timestamp)."""
    id:           uuid.UUID
    couple_names: str
    location:     str | None = None
    year_married: int
    headline:     str
    body:         str
    quote:        str | None = None
    photo_url:    str | None = None
    is_published: bool
    sort_order:   int
    created_at:   datetime
    updated_at:   datetime

    model_config = {"from_attributes": True}


class SuccessStoryAdminRead(SuccessStoryRead):
    """Admin view — adds operational fields the public read withholds."""
    photo_key:         str | None    = None
    consent_signed_at: datetime | None = None
    notes:             str | None    = None


class SuccessStoryWrite(BaseModel):
    """Body for create or update. All fields optional on update."""
    couple_names:       str | None = Field(default=None, max_length=160)
    location:           str | None = Field(default=None, max_length=160)
    year_married:       int | None = Field(default=None, ge=1900, le=2100)
    headline:           str | None = Field(default=None, max_length=220)
    body:               str | None = None
    quote:              str | None = None
    photo_key:          str | None = Field(default=None, max_length=500)
    photo_url:          str | None = Field(default=None, max_length=900)
    is_published:       bool | None = None
    sort_order:         int | None = Field(default=None, ge=0, le=9999)
    consent_signed_at:  datetime | None = None
    notes:              str | None = None
