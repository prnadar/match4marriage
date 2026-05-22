"""
Subscription schemas. Payments are PayPal-only; gateway-specific
request/response models were removed.
"""
from app.schemas.common import BaseSchema


class FeatureLimits(BaseSchema):
    """Current user's plan limits and usage."""

    plan: str
    interests_remaining: int
    contacts_remaining: int
    video_calls_remaining: int
    can_video_call: bool
    can_view_contact: bool
    can_incognito_browse: bool
    can_send_voice_note: bool
    # Core tier gates (mirror app/core/entitlements.py) — used by the client
    # to lock/unlock features and show upgrade prompts.
    can_message: bool
    can_view_photos: bool
    can_view_premium_photos: bool
    can_use_advanced_filters: bool
