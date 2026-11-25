"""
Auth schemas — registration, OTP, token response.
"""
import re

from pydantic import field_validator

from app.schemas.common import BaseSchema


class RegisterRequest(BaseSchema):
    phone: str
    country_code: str = "+91"

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"\D", "", v)
        if len(cleaned) not in (10, 12):
            raise ValueError("Phone must be 10 digits (India) or 12 with country code")
        return cleaned


class OTPVerifyRequest(BaseSchema):
    phone: str
    otp: str
    country_code: str = "+91"

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be 6 digits")
        return v


class TokenResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    is_new_user: bool = False
    email: str | None = None
    phone: str | None = None


class RefreshTokenRequest(BaseSchema):
    refresh_token: str


class FirebaseVerifyRequest(BaseSchema):
    """Payload for POST /auth/firebase-verify — exchange Firebase ID token for backend session."""
    id_token: str


class EmailRegisterRequest(BaseSchema):
    """Payload for POST /auth/email-register — create/upsert user by email after web OTP verification."""
    email: str
    name: str = ""
    gender: str = ""


# ── Account self-service (settings page) ─────────────────────────────────────

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_NAME_RE = re.compile(r"^[^\W\d_]+(?:[ '\u2019\-.]+[^\W\d_]+)*\.?$", re.UNICODE)


def _clean_email(v: str) -> str:
    v = (v or "").strip().lower()
    if len(v) > 254 or not _EMAIL_RE.match(v):
        raise ValueError("Enter a valid email address")
    return v


class ForgotPasswordRequest(BaseSchema):
    """POST /auth/forgot-password — always answers generically."""
    email: str

    @field_validator("email")
    @classmethod
    def _v_email(cls, v: str) -> str:
        return _clean_email(v)


class AccountUpdateRequest(BaseSchema):
    """PATCH /auth/me — basic account fields (display name)."""
    first_name: str | None = None
    last_name: str | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def _v_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = re.sub(r"\s+", " ", v).strip()
        if not v:
            raise ValueError("Name can't be empty")
        if len(v) > 100:
            raise ValueError("Name must be 100 characters or fewer")
        if not _NAME_RE.match(v):
            raise ValueError("Use letters, spaces, hyphens or apostrophes only")
        return v


class ChangeEmailRequest(BaseSchema):
    """POST /auth/change-email — sends a code to the NEW address."""
    new_email: str

    @field_validator("new_email")
    @classmethod
    def _v_email(cls, v: str) -> str:
        return _clean_email(v)


class CodeConfirmRequest(BaseSchema):
    """6-digit code confirmation (email change)."""
    code: str

    @field_validator("code")
    @classmethod
    def _v_code(cls, v: str) -> str:
        v = re.sub(r"\D", "", v or "")
        if len(v) != 6:
            raise ValueError("Enter the 6-digit code")
        return v


class ChangePhoneRequest(BaseSchema):
    """POST /auth/change-phone/request — E.164 number, e.g. +447700900123."""
    phone: str

    @field_validator("phone")
    @classmethod
    def _v_phone(cls, v: str) -> str:
        raw = (v or "").strip()
        digits = re.sub(r"\D", "", raw)
        if not raw.startswith("+") or not (8 <= len(digits) <= 15):
            raise ValueError("Enter the number in international format, e.g. +44 7700 900123")
        return "+" + digits


class NotificationPrefs(BaseSchema):
    email_interests: bool | None = None
    email_messages: bool | None = None
    email_matches: bool | None = None
    email_marketing: bool | None = None


class AccountSettingsUpdate(BaseSchema):
    """PATCH /auth/me/settings — partial update; unknown keys are ignored."""
    notifications: NotificationPrefs | None = None


class DeactivateRequest(BaseSchema):
    reason: str | None = None


class DeleteAccountRequest(BaseSchema):
    """DELETE /auth/me — the member must type DELETE to confirm."""
    confirm: str
    reason: str | None = None

    @field_validator("confirm")
    @classmethod
    def _v_confirm(cls, v: str) -> str:
        if (v or "").strip() != "DELETE":
            raise ValueError("Type DELETE to confirm")
        return "DELETE"
