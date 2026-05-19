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
