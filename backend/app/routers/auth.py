"""
Auth router — registration, OTP, profile bootstrap, email verification.
POST /api/v1/auth/register
POST /api/v1/auth/verify-otp
POST /api/v1/auth/resend-otp
POST /api/v1/auth/send-verification-email
GET  /api/v1/auth/verify-email

Account self-service (member Settings page) — see the section at the bottom:
POST  /api/v1/auth/forgot-password
PATCH /api/v1/auth/me
GET   /api/v1/auth/me/settings          PATCH /api/v1/auth/me/settings
POST  /api/v1/auth/change-email         POST  /api/v1/auth/change-email/confirm
POST  /api/v1/auth/change-phone/request POST  /api/v1/auth/change-phone/confirm
POST  /api/v1/auth/password-changed
POST  /api/v1/auth/sign-out-everywhere
GET   /api/v1/auth/me/export
POST  /api/v1/auth/deactivate           POST  /api/v1/auth/reactivate
POST  /api/v1/auth/delete-account
"""
import asyncio
import hashlib
import json
import random
import secrets
import string
import time
import uuid as _uuid_mod
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum as _Enum
from typing import Annotated, Any
from urllib.parse import parse_qs, quote, urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.core.redis import get_redis
from app.core.security import get_current_user
from app.core.tenancy import get_current_tenant_slug

settings = get_settings()
from app.models.user import User
from app.schemas.auth import (
    AccountSettingsUpdate,
    AccountUpdateRequest,
    ChangeEmailRequest,
    ChangePhoneRequest,
    CodeConfirmRequest,
    DeactivateRequest,
    DeleteAccountRequest,
    EmailRegisterRequest,
    FirebaseVerifyRequest,
    ForgotPasswordRequest,
    OTPVerifyRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.common import APIResponse
from app.services.email import (
    send_email_change_code,
    send_password_reset_email,
    send_security_notice_email,
    send_verification_email,
    send_welcome_email,
)
from app.services.otp import OTPSendError, send_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)

# ── Token constants ───────────────────────────────────────────────────────────
_EMAIL_TOKEN_LEN     = 6
_EMAIL_TOKEN_TTL_SEC = 600   # 10 minutes
_EMAIL_TOKEN_PREFIX  = "email_verify:"


def _generate_email_token() -> str:
    """Generate a 6-digit numeric verification code (e.g. 248913)."""
    return "".join(secrets.choice(string.digits) for _ in range(_EMAIL_TOKEN_LEN))


# ── Existing endpoints ────────────────────────────────────────────────────────


@router.post("/register", response_model=APIResponse[dict])
@limiter.limit("3/minute")
async def register(
    request: Request,
    payload: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Start registration with phone OTP.
    Creates user record if new. Sends OTP via Twilio.
    Rate limited to 3/minute per source IP.
    """
    try:
        await send_otp(payload.phone, payload.country_code, tenant_slug)
    except OTPSendError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return APIResponse(
        success=True,
        data={"phone": payload.phone[-4:].rjust(len(payload.phone), "*")},
        message="OTP sent successfully",
    )


@router.post("/verify-otp", response_model=APIResponse[TokenResponse])
async def verify_otp_endpoint(
    payload: OTPVerifyRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Verify OTP → issue Auth0 token.
    Creates user record if first-time login.
    """
    is_valid = await verify_otp(payload.phone, payload.otp, tenant_slug)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP",
        )

    # Upsert user
    result = await db.execute(
        select(User).where(
            User.phone == payload.phone,
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()
    is_new = user is None

    if is_new:
        from sqlalchemy import text
        tenant_result = await db.execute(
            text("SELECT id FROM tenants WHERE slug = :slug LIMIT 1"),
            {"slug": tenant_slug}
        )
        tenant_row = tenant_result.fetchone()
        tenant_uuid = tenant_row[0] if tenant_row else None

        user = User(
            tenant_id=tenant_uuid,
            phone=payload.phone,
            is_phone_verified=True,
        )
        db.add(user)
        await db.flush()
        logger.info("new_user_created", user_id=str(user.id), tenant=tenant_slug)
    else:
        user.is_phone_verified = True

    # In demo mode (no Auth0), issue a demo token accepted by security middleware
    # In production, replace with real Auth0 M2M token exchange
    if not settings.AUTH0_DOMAIN:
        access_token = f"demo:{str(user.id)}"
    else:
        access_token = "__placeholder_implement_auth0_exchange__"

    token_data = TokenResponse(
        access_token=access_token,
        expires_in=86400,
        user_id=str(user.id),
        is_new_user=is_new,
    )

    return APIResponse(success=True, data=token_data)


@router.post("/firebase-verify", response_model=APIResponse[TokenResponse])
async def firebase_verify_endpoint(
    payload: FirebaseVerifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Verify a Firebase ID token and return a backend session summary.
    Upserts the user by Firebase UID first, then phone/email — so a user who
    previously signed in with email then switches to phone auth is recognised
    as the same person.
    """
    from app.core.firebase import verify_firebase_id_token
    from app.core.security import _find_or_link_user, _normalize_phone
    from sqlalchemy import text

    try:
        decoded_token = verify_firebase_id_token(payload.id_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except Exception as exc:
        logger.warning("firebase_token_invalid", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase token",
        )

    firebase_uid = decoded_token.get("uid") or decoded_token.get("sub")
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Firebase token missing uid")

    phone_raw: str | None = decoded_token.get("phone_number")
    email: str | None = (decoded_token.get("email") or "").strip().lower() or None
    normalized_phone = _normalize_phone(phone_raw)

    if not normalized_phone and not email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Firebase token contains neither phone number nor email",
        )

    # Resolve / link user
    user_id = await _find_or_link_user(db, firebase_uid, phone_raw, email, tenant_slug)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    is_new = user is None

    if is_new:
        from app.routers.profile import _resolve_tenant_uuid
        tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)

        user = User(
            id=user_id,
            tenant_id=tenant_uuid,
            phone=normalized_phone,
            email=email,
            firebase_uids=[firebase_uid],
            is_phone_verified=bool(normalized_phone),
            is_email_verified=bool(decoded_token.get("email_verified")),
        )
        db.add(user)
        try:
            await db.flush()
        except Exception:
            await db.rollback()
            user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        logger.info("firebase_new_user_created", user_id=str(user_id), tenant=tenant_slug)
    else:
        changed = False
        if normalized_phone and not user.phone:
            user.phone = normalized_phone
            changed = True
        if email and not user.email:
            user.email = email
            changed = True
        if normalized_phone:
            user.is_phone_verified = True
            changed = True
        if decoded_token.get("email_verified"):
            user.is_email_verified = True
            changed = True
        if changed:
            await db.flush()

    if not settings.AUTH0_DOMAIN:
        access_token = f"demo:{str(user_id)}"
    else:
        access_token = "__placeholder_implement_auth0_exchange__"

    return APIResponse(
        success=True,
        data=TokenResponse(
            access_token=access_token,
            expires_in=86400,
            user_id=str(user_id),
            is_new_user=is_new,
            email=email,
            phone=normalized_phone,
        ),
    )


@router.get("/me", response_model=APIResponse[dict])
async def auth_me(
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Return the authenticated caller's identity + roles, derived from their
    Firebase ID token. Used by the admin login page to confirm the user
    holds the `admin` role before routing to the admin UI.
    """
    from app.core.security import _roles_from_claims

    user_id = current_user.get("sub") or current_user.get("user_id")
    roles = _roles_from_claims(current_user)

    # Also look up the DB user so we can return email/phone if the token
    # didn't include them (e.g. phone-only sign-ins).
    email = current_user.get("email")
    phone = current_user.get("phone")
    is_email_verified = False
    is_phone_verified = False
    membership_number: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    subscription_tier: str | None = None
    created_at: str | None = None
    try:
        import uuid as _uuid
        from app.services.membership_expiry import expire_if_lapsed
        await expire_if_lapsed(db, user_id)
        db_user = (await db.execute(
            select(User).where(User.id == _uuid.UUID(str(user_id)))
        )).scalar_one_or_none()
        if db_user:
            # Prefer the DB copy: it is updated immediately by change-email /
            # change-phone, whereas the token claim lags until a refresh.
            email = db_user.email or email
            phone = db_user.phone or phone
            is_email_verified = bool(db_user.is_email_verified)
            is_phone_verified = bool(db_user.is_phone_verified)
            membership_number = db_user.membership_number
            tier = getattr(db_user, "subscription_tier", None)
            subscription_tier = getattr(tier, "value", tier)
            created_at = db_user.created_at.isoformat() if db_user.created_at else None
            from app.models.user import UserProfile
            names = (await db.execute(
                select(UserProfile.first_name, UserProfile.last_name).where(
                    UserProfile.user_id == db_user.id, UserProfile.deleted_at.is_(None)
                )
            )).first()
            if names:
                first_name, last_name = names[0] or None, names[1] or None
    except Exception:
        pass

    return APIResponse(
        success=True,
        data={
            "user_id": str(user_id) if user_id else None,
            "email": email,
            "phone": phone,
            "is_email_verified": is_email_verified,
            "is_phone_verified": is_phone_verified,
            "membership_number": membership_number,
            "first_name": first_name,
            "last_name": last_name,
            "subscription_tier": subscription_tier,
            "created_at": created_at,
            "roles": roles,
            "is_admin": "admin" in roles or "super_admin" in roles,
            "is_super_admin": "super_admin" in roles,
        },
    )


@router.post("/resend-otp", response_model=APIResponse[None])
@limiter.limit("3/minute")
async def resend_otp(
    request: Request,
    payload: RegisterRequest,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    try:
        await send_otp(payload.phone, payload.country_code, tenant_slug)
    except OTPSendError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return APIResponse(success=True, message="OTP resent")


# ── Web email registration ────────────────────────────────────────────────────


@router.post("/email-register", response_model=APIResponse[TokenResponse])
async def email_register_endpoint(
    payload: EmailRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Upsert a user by email after the web OTP flow has been verified client-side.
    Called by the Next.js frontend after a successful /api/verify-otp check.

    Does NOT perform OTP verification itself — that is the caller's responsibility.
    """
    import re as _re

    email = payload.email.lower().strip()
    if not email or not _re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid email address",
        )

    result = await db.execute(
        select(User).where(
            User.email == email,
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()
    is_new = user is None

    if not is_new:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please log in instead.",
        )

    from app.models.user import Gender, UserProfile
    from app.routers.profile import _resolve_tenant_uuid

    tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=500, detail=f"Tenant not provisioned: {tenant_slug}")

    name_parts = (payload.name or "").strip().split(None, 1)
    first_name = name_parts[0] if name_parts else ""
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    gender_enum = None
    if payload.gender:
        _g = payload.gender.lower()
        gender_enum = {"male": Gender.MALE, "female": Gender.FEMALE, "other": Gender.OTHER}.get(_g)

    # Create User + UserProfile atomically. If profile insert fails, user is
    # rolled back too — no orphaned auth rows.
    user = User(
        tenant_id=tenant_uuid,
        email=email,
        is_email_verified=True,
    )
    db.add(user)
    try:
        await db.flush()
    except Exception as exc:
        await db.rollback()
        logger.error("email_user_create_failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Could not create account")

    profile = UserProfile(
        tenant_id=tenant_uuid,
        user_id=user.id,
        first_name=first_name,
        last_name=last_name,
        gender=gender_enum,
    )
    db.add(profile)
    try:
        await db.flush()
    except Exception as exc:
        await db.rollback()
        logger.error("email_profile_create_failed", error=str(exc), user_id=str(user.id))
        raise HTTPException(status_code=500, detail="Could not create profile")

    logger.info("web_email_user_created", user_id=str(user.id), tenant=tenant_slug)

    if not settings.AUTH0_DOMAIN:
        access_token = f"demo:{str(user.id)}"
    else:
        access_token = "__placeholder_implement_auth0_exchange__"

    return APIResponse(
        success=True,
        data=TokenResponse(
            access_token=access_token,
            expires_in=86400,
            user_id=str(user.id),
            is_new_user=is_new,
            email=email,
        ),
    )


# ── Email existence check ────────────────────────────────────────────────────


@router.post("/check-email", response_model=APIResponse[dict])
async def check_email_exists(
    payload: EmailRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return whether an email is already registered. Used before sending OTP."""
    import re as _re

    email = payload.email.lower().strip()
    if not email or not _re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        raise HTTPException(status_code=422, detail="Invalid email address")

    result = await db.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    exists = result.scalar_one_or_none() is not None
    return APIResponse(success=True, data={"exists": exists})


# ── Email verification endpoints ──────────────────────────────────────────────


async def _ensure_auth_user(db: AsyncSession, current_user: dict, tenant_slug: str) -> User:
    """
    Return the caller's auth-user row, creating it (with NO profile) if needed.

    Onboarding defers profile creation to its final step, so during email
    verification the DB row may not exist yet — but we still need somewhere to
    send the code and record email-verified. We therefore create the *user* row
    only. A user row WITHOUT a profile is NOT a member (the gate, browse and
    matches all key off profiles); abandoned ones are removed by
    /profile/me/discard-incomplete.
    """
    import uuid as _uuid

    user_uuid = _uuid.UUID(str(current_user.get("sub") or current_user.get("user_id") or ""))
    user = (await db.execute(
        select(User).where(User.id == user_uuid, User.deleted_at.is_(None))
    )).scalar_one_or_none()
    if user is not None:
        return user

    from app.routers.profile import _resolve_tenant_uuid
    tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=500, detail="Tenant not provisioned")

    fb_uid = current_user.get("firebase_uid")
    user = User(
        id=user_uuid,
        tenant_id=tenant_uuid,
        email=current_user.get("email"),
        firebase_uids=[fb_uid] if fb_uid else [],
        is_email_verified=bool(current_user.get("email_verified")),
    )
    db.add(user)
    try:
        await db.flush()
    except Exception:
        # Concurrent create — re-fetch the row created by the other request.
        await db.rollback()
        user = (await db.execute(
            select(User).where(User.id == user_uuid)
        )).scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=500, detail="Could not provision your account")
    return user


@router.post("/send-verification-email", response_model=APIResponse[dict])
@limiter.limit("2/minute")
async def send_verification_email_endpoint(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Send a 6-character email verification token to the authenticated user's
    registered email address.

    Rate: honours the global rate-limit middleware (10/min per IP by default).
    The token is stored in Redis with a 10-minute TTL.
    """
    import uuid

    # Resolve user from JWT sub
    try:
        user_uuid = uuid.UUID(current_user.get("sub", ""))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user session",
        )

    # Onboarding defers profile creation, so the DB row may not exist yet at
    # this stage — provision the auth-user row (no profile) so there's
    # somewhere to send the code and record email-verified.
    user = await _ensure_auth_user(db, current_user, tenant_slug)

    if user.is_email_verified:
        return APIResponse(
            success=True,
            data={"email_verified": True},
            message="Email is already verified",
        )

    if not user.email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No email address on file. Please update your profile first.",
        )

    token = _generate_email_token()

    # Store token keyed by USER (not by the token itself). The previous shape
    # (`email_verify:<token>` → user_id) made the entire 6-digit keyspace
    # brute-forceable across all pending users: an attacker only needed to
    # guess any valid code anywhere in the system to take over the matching
    # account. Keying by user means a brute-force attempt is bounded per
    # target user and is further blocked by the verify-time attempt counter.
    redis = await get_redis()
    redis_key = f"{_EMAIL_TOKEN_PREFIX}user:{user_uuid}"
    await redis.setex(redis_key, _EMAIL_TOKEN_TTL_SEC, token)
    # Reset any prior attempt counter so a new token gives a fresh window.
    try:
        await redis.delete(f"{_EMAIL_TOKEN_PREFIX}attempts:{user_uuid}")
    except Exception:
        pass

    # Derive display name
    display_name = user.email.split("@")[0]
    try:
        profile_result = await db.execute(
            select(User.id).where(User.id == user_uuid)      # lightweight check
        )
    except Exception:
        pass

    # Try to get first_name from profile
    try:
        from app.models.user import UserProfile
        profile_result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == user_uuid)
        )
        profile = profile_result.scalar_one_or_none()
        if profile and profile.first_name:
            display_name = profile.first_name
    except Exception:
        pass

    sent = await send_verification_email(
        email=user.email,
        token=token,
        user_name=display_name,
    )

    if not sent:
        logger.error("email_send_failed", user_id=str(user_uuid))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send verification email. Please try again shortly.",
        )

    logger.info("verification_email_sent", user_id=str(user_uuid), email=user.email[:6] + "***")
    return APIResponse(
        success=True,
        data={"email": user.email[:3] + "***" + user.email[user.email.index("@"):]},
        message="Verification email sent. Please check your inbox.",
    )


@router.get("/verify-email", response_model=APIResponse[dict])
@limiter.limit("10/minute")
async def verify_email_endpoint(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    token: str = Query(..., min_length=6, max_length=6, description="6-digit verification code"),
):
    """
    Verify the authenticated member's email using the 6-digit code that was
    sent to them. Authentication is REQUIRED — the previous unauthenticated
    + token-keyed shape let an attacker brute-force any pending verification
    across the entire user base.

    On success:
    - Sets User.is_email_verified = True
    - Deletes the token from Redis (single-use)
    - Sends a welcome email

    Rate-limit: 10 attempts/minute per IP plus a per-user lockout after 5
    wrong attempts in the token's 10-minute TTL window.
    """
    import uuid

    try:
        user_uuid = uuid.UUID(str(current_user.get("sub", "")))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    redis = await get_redis()
    redis_key = f"{_EMAIL_TOKEN_PREFIX}user:{user_uuid}"
    attempts_key = f"{_EMAIL_TOKEN_PREFIX}attempts:{user_uuid}"

    # Per-user lockout — bounds brute-force to ~5 guesses per token.
    try:
        attempts = int(await redis.get(attempts_key) or 0)
    except Exception:
        attempts = 0
    if attempts >= 5:
        logger.warning("email_verify_locked", user_id=str(user_uuid))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Tap Resend to get a new code.",
        )

    stored = await redis.get(redis_key)
    # Constant-time compare on the actual code value, after we know we have one.
    if not stored or not secrets.compare_digest(str(stored), token):
        try:
            await redis.incr(attempts_key)
            await redis.expire(attempts_key, _EMAIL_TOKEN_TTL_SEC)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    user = await _ensure_auth_user(db, current_user, tenant_slug)

    if user.is_email_verified:
        await redis.delete(redis_key)
        return APIResponse(
            success=True,
            data={"email_verified": True},
            message="Email already verified",
        )

    user.is_email_verified = True
    await db.flush()

    # Single-use: clear token + attempts.
    await redis.delete(redis_key)
    try:
        await redis.delete(attempts_key)
    except Exception:
        pass

    logger.info("email_verified", user_id=str(user_uuid))

    # Derive display name for welcome email
    display_name = (user.email or "").split("@")[0]
    try:
        from app.models.user import UserProfile
        profile_result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == user_uuid)
        )
        profile = profile_result.scalar_one_or_none()
        if profile and profile.first_name:
            display_name = profile.first_name
    except Exception:
        pass

    if user.email:
        await send_welcome_email(email=user.email, user_name=display_name)

    return APIResponse(
        success=True,
        data={"email_verified": True, "user_id": str(user_uuid)},
        message="Email verified successfully! Welcome to Match4Marriage.",
    )


# ══════════════════════════════════════════════════════════════════════════════
# Account self-service — forgot password, account details, privacy & data
# ══════════════════════════════════════════════════════════════════════════════
#
# Identity model recap: Firebase Auth owns credentials (email/password and the
# linked phone number). The `users` row mirrors email/phone for lookups and
# uniqueness. So every change below is applied to Firebase *and* the DB row.
#
# Sensitive operations (change email/phone, deactivate, delete) require a
# *recent* sign-in: the client re-authenticates with the member's current
# password (reauthenticateWithCredential) and sends a fresh ID token, whose
# `auth_time` claim we check. We answer 403 (never 401 — the web client treats
# 401 as "session dead" and signs the member out) with code `reauth_required`.

_RECENT_AUTH_MAX_AGE_SEC = 5 * 60
_EMAIL_CHANGE_PREFIX = "email_change:"
_PW_RESET_PREFIX = "pw_reset:"
_PW_RESET_PER_EMAIL_PER_HOUR = 5
_EMAIL_CHANGE_PER_USER_PER_HOUR = 5
_PW_RESET_LINK_TTL_MIN = 60  # Firebase password-reset oobCodes live for 1 hour

_NOTIFICATION_DEFAULTS: dict[str, bool] = {
    "email_interests": True,   # someone expresses interest / accepts yours
    "email_messages": True,    # new chat message while you're away
    "email_matches": True,     # new match recommendations
    "email_marketing": False,  # offers & news — opt-in only (PECR/GDPR)
}

_account_settings_column_ready = False


def _frontend_base() -> str:
    return (settings.FRONTEND_URL or "").rstrip("/") or "http://localhost:3000"


def _caller_uuid(current_user: dict) -> _uuid_mod.UUID:
    try:
        return _uuid_mod.UUID(str(current_user.get("sub") or current_user.get("user_id") or ""))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")


def _require_recent_auth(claims: dict) -> None:
    try:
        auth_time = int(claims.get("auth_time") or 0)
    except (TypeError, ValueError):
        auth_time = 0
    if time.time() - auth_time > _RECENT_AUTH_MAX_AGE_SEC:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "reauth_required",
                "message": "For your security, please confirm your password and try again.",
            },
        )


def _firebase_app_or_503():
    from app.core.firebase import get_firebase_app
    fb_app = get_firebase_app()
    if fb_app is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account service is temporarily unavailable. Please try again shortly.",
        )
    return fb_app


def _mask_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return email
    local, domain = email.split("@", 1)
    return (local[:2] + "***" if len(local) > 2 else local[:1] + "***") + "@" + domain


def _mask_phone(phone: str | None) -> str | None:
    if not phone:
        return phone
    return "•••• " + phone[-4:]


async def _ensure_account_settings_column() -> None:
    """
    Request-time fallback for the boot guard in main.py (Vercel cold starts can
    skip the FastAPI lifespan). Runs once per process on its own AUTOCOMMIT
    connection, checks information_schema first, and only ALTERs when the
    column is genuinely missing — with a short lock_timeout so it can never
    deadlock live reads.
    """
    global _account_settings_column_ready
    if _account_settings_column_ready:
        return
    from sqlalchemy import text as _text
    from app.core.database import engine
    try:
        async with engine.connect() as conn:
            if conn.dialect.name != "postgresql":
                _account_settings_column_ready = True
                return
            await conn.execution_options(isolation_level="AUTOCOMMIT")
            present = (await conn.execute(_text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'users' AND column_name = 'account_settings'"
            ))).first()
            if not present:
                await conn.execute(_text("SET lock_timeout = '800ms'"))
                await conn.execute(_text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_settings "
                    "JSONB NOT NULL DEFAULT '{}'::jsonb"
                ))
            _account_settings_column_ready = True
    except Exception as exc:
        logger.warning("account_settings_column_guard_failed", error=str(exc))


async def _read_account_settings(db: AsyncSession, user_id: _uuid_mod.UUID) -> dict:
    await _ensure_account_settings_column()
    try:
        async with db.begin_nested():
            val = (await db.execute(
                select(User.account_settings).where(User.id == user_id)
            )).scalar_one_or_none()
    except Exception as exc:
        logger.warning("account_settings_read_failed", error=str(exc))
        return {}
    if isinstance(val, str):  # some drivers hand JSON back as text
        try:
            val = json.loads(val)
        except ValueError:
            val = None
    return dict(val) if isinstance(val, dict) else {}


async def _write_account_settings(db: AsyncSession, user_id: _uuid_mod.UUID, data: dict) -> None:
    await _ensure_account_settings_column()
    try:
        async with db.begin_nested():
            await db.execute(
                update(User).where(User.id == user_id).values(account_settings=data)
                .execution_options(synchronize_session=False)
            )
    except Exception as exc:
        logger.error("account_settings_write_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Couldn't save your settings right now. Please try again in a moment.",
        )


def _notification_prefs(stored: dict) -> dict[str, bool]:
    saved = stored.get("notifications") if isinstance(stored.get("notifications"), dict) else {}
    return {k: bool(saved.get(k, default)) for k, default in _NOTIFICATION_DEFAULTS.items()}


async def member_wants_email(db: AsyncSession, user_id: _uuid_mod.UUID, kind: str) -> bool:
    """
    Public helper for any sender (interests, chat, matching digests): returns
    whether the member allows `kind` emails — one of email_interests,
    email_messages, email_matches, email_marketing. Unknown kinds → True
    (transactional/security mail is never suppressed).
    """
    if kind not in _NOTIFICATION_DEFAULTS:
        return True
    return _notification_prefs(await _read_account_settings(db, user_id))[kind]


async def _first_name_for(db: AsyncSession, user: User | None, fallback_email: str | None = None) -> str:
    from app.models.user import UserProfile
    if user is not None:
        try:
            fn = (await db.execute(
                select(UserProfile.first_name).where(UserProfile.user_id == user.id)
            )).scalar_one_or_none()
            if fn and fn.strip():
                return fn.strip()
        except Exception:
            pass
    src = (user.email if user is not None else None) or fallback_email or ""
    return src.split("@")[0] or "there"


async def _redis_or_none():
    try:
        return await get_redis()
    except Exception:
        return None


# ── Forgot password ───────────────────────────────────────────────────────────


def _render_template(text_: str, values: dict[str, str], escape: bool) -> str:
    import html as _html
    import re as _re

    def _sub(m):
        key = m.group(1).strip().lower()
        if key not in values:
            return m.group(0)
        return _html.escape(values[key], quote=True) if escape else values[key]

    return _re.sub(r"\{\{\s*([a-zA-Z_]+)\s*\}\}", _sub, text_ or "")


async def _deliver_password_reset(email: str, tenant_slug: str) -> None:
    """
    Background task: mint a Firebase reset code via the Admin SDK and email a
    link that lands on OUR /auth/reset-password page (not Firebase's generic
    handler). Silently does nothing for unknown emails — the endpoint has
    already answered generically, so timing doesn't reveal account existence.
    """
    from firebase_admin import auth as fb_auth
    from app.core.firebase import get_firebase_app

    fb_app = get_firebase_app()
    if fb_app is None:
        return

    continue_url = f"{_frontend_base()}/auth/login?reset=done"
    link: str | None = None
    try:
        link = await asyncio.to_thread(
            fb_auth.generate_password_reset_link,
            email,
            fb_auth.ActionCodeSettings(url=continue_url),
            fb_app,
        )
    except fb_auth.UserNotFoundError:
        logger.info("password_reset_unknown_email")
        return
    except Exception as exc:
        # Most likely the frontend domain isn't on Firebase's authorised-domain
        # list (continue URL rejected). Retry without a continue URL — we only
        # need the oobCode, which we wrap in our own link below.
        logger.warning("password_reset_link_with_continue_failed", error=str(exc))
        try:
            link = await asyncio.to_thread(fb_auth.generate_password_reset_link, email, None, fb_app)
        except fb_auth.UserNotFoundError:
            logger.info("password_reset_unknown_email")
            return
        except Exception as exc2:
            logger.error("password_reset_link_failed", error=str(exc2))
            return

    oob = (parse_qs(urlparse(link).query).get("oobCode") or [None])[0]
    reset_url = (
        f"{_frontend_base()}/auth/reset-password?mode=resetPassword&oobCode={quote(oob, safe='')}"
        if oob else link
    )

    name = "there"
    subject = html_body = text_body = None
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.mail_template import MailTemplate
        from app.routers.profile import _resolve_tenant_uuid

        async with AsyncSessionLocal() as s:
            row = (await s.execute(
                select(User).where(func.lower(User.email) == email, User.deleted_at.is_(None)).limit(1)
            )).scalar_one_or_none()
            name = await _first_name_for(s, row, email)
            tenant_uuid = await _resolve_tenant_uuid(s, tenant_slug)
            tmpl = None
            if tenant_uuid is not None:
                tmpl = (await s.execute(
                    select(MailTemplate).where(
                        MailTemplate.tenant_id == tenant_uuid,
                        MailTemplate.key == "password_reset",
                        MailTemplate.is_active.is_(True),
                        MailTemplate.deleted_at.is_(None),
                    )
                )).scalar_one_or_none()
            # Admin-managed template (Admin → CMS → Mail templates →
            # "password_reset"). Placeholders: {{name}}, {{reset_link}},
            # {{expires_in}}. Only used when it actually contains the link.
            if tmpl is not None and tmpl.body_html and _re_has_link_placeholder(tmpl.body_html):
                vals = {
                    "name": name, "first_name": name,
                    "reset_link": reset_url, "reset_url": reset_url, "link": reset_url,
                    "expires_in": f"{_PW_RESET_LINK_TTL_MIN} minutes",
                }
                subject = _render_template(tmpl.subject, vals, escape=False) or None
                html_body = _render_template(tmpl.body_html, vals, escape=True)
                text_body = _render_template(tmpl.body_text, vals, escape=False) if tmpl.body_text else None
            elif tmpl is not None:
                logger.warning("password_reset_template_missing_link_placeholder")
    except Exception as exc:
        logger.warning("password_reset_context_lookup_failed", error=str(exc))

    sent = await send_password_reset_email(
        email=email,
        reset_url=reset_url,
        user_name=name,
        expires_minutes=_PW_RESET_LINK_TTL_MIN,
        subject=subject,
        html_override=html_body,
        text_override=text_body,
    )
    if not sent:
        logger.error("password_reset_email_send_failed")
    else:
        logger.info("password_reset_email_sent", email=_mask_email(email))


def _re_has_link_placeholder(body: str) -> bool:
    import re as _re
    return bool(_re.search(r"\{\{\s*(reset_link|reset_url|link)\s*\}\}", body or "", _re.I))


@router.post("/forgot-password", response_model=APIResponse[dict])
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    background: BackgroundTasks,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Email a password-reset link. ALWAYS answers the same generic message for
    any well-formed address so it can't be used to discover accounts; the
    Firebase lookup + email send happen in a background task after the
    response so timing is uniform too.

    Throttles: 5/minute per IP (limiter) + 5/hour per email address (silent).
    Answers 503 `reset_email_unavailable` only for server-wide configuration
    gaps (no Firebase Admin creds / no RESEND_API_KEY) — independent of the
    email — so the web client can fall back to Firebase's own mailer.
    """
    generic = APIResponse(
        success=True,
        data={"sent": True},
        message="If an account exists for that email, we've sent a link to reset your password.",
    )
    from app.core.firebase import get_firebase_app
    if get_firebase_app() is None or not settings.RESEND_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "reset_email_unavailable",
                "message": "Password reset email is temporarily unavailable.",
            },
        )

    redis = await _redis_or_none()
    if redis is not None:
        try:
            key = f"{_PW_RESET_PREFIX}{hashlib.sha256(payload.email.encode()).hexdigest()}"
            n = await redis.incr(key)
            if n == 1:
                await redis.expire(key, 3600)
            if n > _PW_RESET_PER_EMAIL_PER_HOUR:
                logger.info("password_reset_throttled")
                return generic
        except Exception:
            pass

    background.add_task(_deliver_password_reset, payload.email, tenant_slug)
    return generic


# ── Account details ───────────────────────────────────────────────────────────


@router.patch("/me", response_model=APIResponse[dict])
@limiter.limit("20/minute")
async def update_account(
    request: Request,
    payload: AccountUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Edit basic account fields (display name). Syncs Firebase displayName."""
    from app.models.user import UserProfile

    if payload.first_name is None and payload.last_name is None:
        raise HTTPException(status_code=422, detail="Nothing to update")
    uid = _caller_uuid(current_user)
    profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == uid, UserProfile.deleted_at.is_(None))
    )).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Finish creating your profile first.")

    if payload.first_name is not None:
        profile.first_name = payload.first_name
    if payload.last_name is not None:
        profile.last_name = payload.last_name
    # Bump the optimistic-lock counter so an open profile editor with a stale
    # version can't silently overwrite the new name.
    profile.version = (getattr(profile, "version", 0) or 0) + 1
    await db.flush()

    fb_uid = current_user.get("firebase_uid")
    if fb_uid:
        try:
            from firebase_admin import auth as fb_auth
            from app.core.firebase import get_firebase_app
            fb_app = get_firebase_app()
            if fb_app is not None:
                display = f"{profile.first_name} {profile.last_name}".strip()
                await asyncio.to_thread(fb_auth.update_user, fb_uid, display_name=display, app=fb_app)
        except Exception as exc:
            logger.warning("firebase_display_name_sync_failed", error=str(exc))

    return APIResponse(
        success=True,
        data={"first_name": profile.first_name, "last_name": profile.last_name, "version": profile.version},
        message="Your name has been updated.",
    )


@router.get("/me/settings", response_model=APIResponse[dict])
async def get_account_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    stored = await _read_account_settings(db, _caller_uuid(current_user))
    return APIResponse(success=True, data={"notifications": _notification_prefs(stored)})


@router.patch("/me/settings", response_model=APIResponse[dict])
@limiter.limit("30/minute")
async def update_account_settings(
    request: Request,
    payload: AccountSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Partially update notification/communication preferences."""
    uid = _caller_uuid(current_user)
    await _ensure_auth_user(db, current_user, tenant_slug)
    stored = await _read_account_settings(db, uid)
    prefs = _notification_prefs(stored)
    was_marketing = prefs.get("email_marketing")
    if payload.notifications is not None:
        for k, v in payload.notifications.model_dump(exclude_none=True).items():
            if k in _NOTIFICATION_DEFAULTS:
                prefs[k] = bool(v)
    stored["notifications"] = prefs
    stored["notifications_updated_at"] = datetime.now(timezone.utc).isoformat()
    await _write_account_settings(db, uid, stored)

    # PECR: keep a timestamped record whenever marketing consent changes.
    if prefs.get("email_marketing") != was_marketing:
        try:
            from app.routers.consents import record_consents
            user_row = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
            if user_row is not None:
                async with db.begin_nested():
                    await record_consents(
                        db, user_id=uid, tenant_id=user_row.tenant_id,
                        decisions={"marketing_email": bool(prefs.get("email_marketing"))},
                        source="settings",
                        ip=(request.headers.get("x-forwarded-for") or "").split(",")[0].strip()[:64] or None,
                        user_agent=request.headers.get("user-agent"),
                    )
        except Exception as exc:  # never fail a preference save over the log
            logger.warning("marketing_consent_log_failed", error=str(exc))
    return APIResponse(success=True, data={"notifications": prefs}, message="Preferences saved.")


# ── Change email (code sent to the NEW address) ──────────────────────────────


@router.post("/change-email", response_model=APIResponse[dict])
@limiter.limit("3/minute")
async def request_email_change(
    request: Request,
    payload: ChangeEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Step 1 of an email change: requires a recent sign-in, checks the address
    is free in this tenant (and in Firebase), then emails a 6-digit code to
    the NEW address. Nothing changes until /change-email/confirm.
    """
    _require_recent_auth(current_user)
    uid = _caller_uuid(current_user)
    user = await _ensure_auth_user(db, current_user, tenant_slug)
    new_email = payload.new_email

    if user.email and user.email.lower() == new_email:
        raise HTTPException(status_code=400, detail="That's already the email on your account.")

    # Uniqueness per tenant. Deliberately NOT filtered on deleted_at — the DB
    # unique constraint (tenant_id, email) covers soft-deleted rows too.
    clash = (await db.execute(
        select(User.id).where(
            func.lower(User.email) == new_email,
            User.tenant_id == user.tenant_id,
            User.id != uid,
        ).limit(1)
    )).scalar_one_or_none()
    if clash is not None:
        raise HTTPException(status_code=409, detail="That email address is already used by another account.")

    fb_app = _firebase_app_or_503()
    from firebase_admin import auth as fb_auth
    try:
        other = await asyncio.to_thread(fb_auth.get_user_by_email, new_email, fb_app)
        if other.uid != current_user.get("firebase_uid"):
            raise HTTPException(status_code=409, detail="That email address is already used by another account.")
    except fb_auth.UserNotFoundError:
        pass
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("change_email_firebase_lookup_failed", error=str(exc))

    redis = await get_redis()
    count_key = f"{_EMAIL_CHANGE_PREFIX}count:{uid}"
    try:
        n = await redis.incr(count_key)
        if n == 1:
            await redis.expire(count_key, 3600)
        if n > _EMAIL_CHANGE_PER_USER_PER_HOUR:
            raise HTTPException(status_code=429, detail="Too many email-change requests. Please try again later.")
    except HTTPException:
        raise
    except Exception:
        pass

    code = _generate_email_token()
    await redis.setex(
        f"{_EMAIL_CHANGE_PREFIX}user:{uid}",
        _EMAIL_TOKEN_TTL_SEC,
        json.dumps({"email": new_email, "code": code}),
    )
    try:
        await redis.delete(f"{_EMAIL_CHANGE_PREFIX}attempts:{uid}")
    except Exception:
        pass

    sent = await send_email_change_code(new_email, code, await _first_name_for(db, user))
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="We couldn't send the confirmation email. Please try again shortly.",
        )
    logger.info("email_change_code_sent", user_id=str(uid))
    return APIResponse(
        success=True,
        data={"email": _mask_email(new_email), "expires_in": _EMAIL_TOKEN_TTL_SEC},
        message="We've sent a 6-digit code to your new email address.",
    )


@router.post("/change-email/confirm", response_model=APIResponse[dict])
@limiter.limit("10/minute")
async def confirm_email_change(
    request: Request,
    payload: CodeConfirmRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Step 2: verify the code, then switch the email in Firebase + DB."""
    uid = _caller_uuid(current_user)
    redis = await get_redis()
    key = f"{_EMAIL_CHANGE_PREFIX}user:{uid}"
    attempts_key = f"{_EMAIL_CHANGE_PREFIX}attempts:{uid}"

    try:
        attempts = int(await redis.get(attempts_key) or 0)
    except Exception:
        attempts = 0
    if attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")

    raw = await redis.get(key)
    pending: dict[str, Any] = {}
    if raw:
        try:
            pending = json.loads(raw)
        except ValueError:
            pending = {}
    if not pending.get("code") or not secrets.compare_digest(str(pending["code"]), payload.code):
        try:
            await redis.incr(attempts_key)
            await redis.expire(attempts_key, _EMAIL_TOKEN_TTL_SEC)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail="That code is invalid or has expired.")

    new_email = str(pending["email"]).lower()
    user = await _ensure_auth_user(db, current_user, tenant_slug)
    old_email = user.email

    # Re-check uniqueness (race between request and confirm).
    clash = (await db.execute(
        select(User.id).where(
            func.lower(User.email) == new_email,
            User.tenant_id == user.tenant_id,
            User.id != uid,
        ).limit(1)
    )).scalar_one_or_none()
    if clash is not None:
        raise HTTPException(status_code=409, detail="That email address is already used by another account.")

    fb_app = _firebase_app_or_503()
    from firebase_admin import auth as fb_auth
    fb_uid = current_user.get("firebase_uid")
    try:
        await asyncio.to_thread(
            fb_auth.update_user, fb_uid, email=new_email, email_verified=True, app=fb_app
        )
    except fb_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="That email address is already used by another account.")
    except Exception as exc:
        logger.error("change_email_firebase_update_failed", error=str(exc))
        raise HTTPException(status_code=503, detail="We couldn't update your email right now. Please try again.")

    user.email = new_email
    user.is_email_verified = True
    await db.flush()
    try:
        await redis.delete(key)
        await redis.delete(attempts_key)
    except Exception:
        pass

    logger.info("email_changed", user_id=str(uid))
    if old_email and old_email.lower() != new_email:
        try:
            await send_security_notice_email(
                old_email,
                await _first_name_for(db, user),
                "Your email address was changed",
                f"The email address on your Match4Marriage account was changed to {_mask_email(new_email)}. "
                "From now on, use the new address to sign in.",
            )
        except Exception:
            pass

    return APIResponse(
        success=True,
        data={"email": new_email, "is_email_verified": True},
        message="Your email address has been updated.",
    )


# ── Change phone (SMS verification is done by Firebase Phone Auth) ───────────


async def _phone_clash(db: AsyncSession, tenant_id, uid: _uuid_mod.UUID, normalized: str) -> bool:
    row = (await db.execute(
        select(User.id).where(User.phone == normalized, User.tenant_id == tenant_id, User.id != uid).limit(1)
    )).scalar_one_or_none()
    return row is not None


@router.post("/change-phone/request", response_model=APIResponse[dict])
@limiter.limit("5/minute")
async def request_phone_change(
    request: Request,
    payload: ChangePhoneRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Pre-flight for a phone change: requires a recent sign-in and checks the
    number isn't used by another member. The client then sends the SMS code
    with Firebase Phone Auth (verifyPhoneNumber → updatePhoneNumber) — the same
    provider onboarding uses — and finally calls /change-phone/confirm.
    """
    from app.core.security import _normalize_phone

    _require_recent_auth(current_user)
    uid = _caller_uuid(current_user)
    user = await _ensure_auth_user(db, current_user, tenant_slug)
    normalized = _normalize_phone(payload.phone)
    if not normalized:
        raise HTTPException(status_code=422, detail="Enter a valid phone number.")
    if user.phone and user.phone == normalized:
        raise HTTPException(status_code=400, detail="That's already the number on your account.")
    if await _phone_clash(db, user.tenant_id, uid, normalized):
        raise HTTPException(status_code=409, detail="That number is already registered to another account.")

    from app.core.firebase import get_firebase_app
    fb_app = get_firebase_app()
    if fb_app is not None:
        from firebase_admin import auth as fb_auth
        try:
            other = await asyncio.to_thread(fb_auth.get_user_by_phone_number, payload.phone, fb_app)
            if other.uid != current_user.get("firebase_uid"):
                raise HTTPException(status_code=409, detail="That number is already registered to another account.")
        except fb_auth.UserNotFoundError:
            pass
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("change_phone_firebase_lookup_failed", error=str(exc))

    return APIResponse(success=True, data={"available": True, "phone": payload.phone})


@router.post("/change-phone/confirm", response_model=APIResponse[dict])
@limiter.limit("10/minute")
async def confirm_phone_change(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Sync the phone number from Firebase after the client completed
    updatePhoneNumber(). The number is read from the Firebase user record via
    the Admin SDK (authoritative, already SMS-verified) — never from the body.
    """
    from firebase_admin import auth as fb_auth
    from app.core.security import _normalize_phone

    uid = _caller_uuid(current_user)
    user = await _ensure_auth_user(db, current_user, tenant_slug)
    fb_app = _firebase_app_or_503()
    try:
        fb_user = await asyncio.to_thread(fb_auth.get_user, current_user.get("firebase_uid"), fb_app)
    except Exception as exc:
        logger.error("change_phone_firebase_get_failed", error=str(exc))
        raise HTTPException(status_code=503, detail="We couldn't confirm your number right now. Please try again.")

    e164 = getattr(fb_user, "phone_number", None)
    normalized = _normalize_phone(e164)
    if not normalized:
        raise HTTPException(status_code=400, detail="No verified phone number found. Please verify the code first.")
    if await _phone_clash(db, user.tenant_id, uid, normalized):
        raise HTTPException(status_code=409, detail="That number is already registered to another account.")

    old_phone = user.phone
    user.phone = normalized
    user.is_phone_verified = True
    await db.flush()
    logger.info("phone_changed", user_id=str(uid), changed=old_phone != normalized)

    if user.email and old_phone and old_phone != normalized:
        try:
            await send_security_notice_email(
                user.email,
                await _first_name_for(db, user),
                "Your phone number was changed",
                f"The mobile number on your Match4Marriage account was changed to one ending {normalized[-4:]}.",
            )
        except Exception:
            pass

    return APIResponse(
        success=True,
        data={"phone": e164, "is_phone_verified": True},
        message="Your phone number has been updated.",
    )


# ── Password changed notice / sign out everywhere ────────────────────────────


@router.post("/password-changed", response_model=APIResponse[dict])
@limiter.limit("3/minute")
async def password_changed_notice(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    The password itself is changed client-side in Firebase (re-authenticate
    with the current password, then updatePassword). This only sends the
    member a "your password was changed" security notice.
    """
    uid = _caller_uuid(current_user)
    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    if user and user.email:
        try:
            await send_security_notice_email(
                user.email,
                await _first_name_for(db, user),
                "Your password was changed",
                "The password for your Match4Marriage account was just changed.",
            )
        except Exception:
            pass
    return APIResponse(success=True, data={"notified": bool(user and user.email)})


async def _revoke_all_sessions(user: User | None, current_fb_uid: str | None) -> int:
    from firebase_admin import auth as fb_auth
    from app.core.firebase import get_firebase_app
    fb_app = get_firebase_app()
    if fb_app is None:
        return 0
    uids = set(getattr(user, "firebase_uids", None) or [])
    if current_fb_uid:
        uids.add(current_fb_uid)
    done = 0
    for fu in uids:
        try:
            await asyncio.to_thread(fb_auth.revoke_refresh_tokens, fu, fb_app)
            done += 1
        except Exception as exc:
            logger.warning("revoke_refresh_tokens_failed", error=str(exc))
    return done


@router.post("/sign-out-everywhere", response_model=APIResponse[dict])
@limiter.limit("3/minute")
async def sign_out_everywhere(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Revoke every Firebase refresh token for this member (all devices)."""
    _firebase_app_or_503()
    uid = _caller_uuid(current_user)
    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    n = await _revoke_all_sessions(user, current_user.get("firebase_uid"))
    return APIResponse(success=True, data={"revoked": n}, message="You've been signed out on all devices.")


# ── GDPR export (Article 15 / 20) ────────────────────────────────────────────

_EXPORT_USER_EXCLUDE = {"aadhaar_hash", "pan_hash", "auth0_sub", "firebase_uids", "account_settings"}


def _json_safe(v: Any) -> Any:
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, _uuid_mod.UUID):
        return str(v)
    if isinstance(v, _Enum):
        return v.value
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, dict):
        return {str(k): _json_safe(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_json_safe(x) for x in v]
    return v


def _row_dict(obj: Any, exclude: set[str] | None = None) -> dict[str, Any]:
    """All loaded column attributes of an ORM row (skips deferred columns)."""
    from sqlalchemy import inspect as sa_inspect
    exclude = exclude or set()
    out: dict[str, Any] = {}
    for attr in sa_inspect(obj).mapper.column_attrs:
        if attr.key in exclude or getattr(attr, "deferred", False):
            continue
        out[attr.key] = _json_safe(getattr(obj, attr.key, None))
    return out


async def build_personal_data_export(db: AsyncSession, uid: _uuid_mod.UUID) -> dict[str, Any] | None:
    """
    Assemble one member's personal data (Art. 15 / 20) as a JSON-safe dict:
    account, profile, interests, matches, chat threads + message METADATA (no
    message bodies), subscriptions & credits, notifications, verifications,
    consent records and settings. Returns None when the user row doesn't exist.

    Shared by the member's own GET /auth/me/export and the admin data-request
    export (routers/admin_compliance.py) so both always produce the same file.
    Works for soft-deleted accounts too (the admin path needs that).
    """
    from app.models.consent import UserConsent
    from app.models.match import ChatThread, Interest, Match, Message
    from app.models.notification import Notification
    from app.models.subscription import CreditTransaction, Subscription
    from app.models.user import UserProfile
    from app.models.verification import Verification

    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    if user is None:
        return None

    async def _safe(label: str, coro):
        try:
            async with db.begin_nested():
                return await coro
        except Exception as exc:
            logger.warning("export_section_failed", section=label, error=str(exc))
            return None

    async def _all(stmt):
        return list((await db.execute(stmt)).scalars().all())

    profile = await _safe("profile", _all(select(UserProfile).where(UserProfile.user_id == uid)))
    interests = await _safe("interests", _all(
        select(Interest).where(or_(Interest.sender_id == uid, Interest.receiver_id == uid))
        .order_by(Interest.created_at.desc())
    ))
    matches = await _safe("matches", _all(
        select(Match).where(or_(Match.user_a_id == uid, Match.user_b_id == uid))
        .order_by(Match.created_at.desc())
    ))
    threads = await _safe("chat_threads", _all(
        select(ChatThread).where(or_(ChatThread.user_a_id == uid, ChatThread.user_b_id == uid))
    )) or []
    messages = []
    if threads:
        messages = await _safe("messages", _all(
            select(Message).where(Message.thread_id.in_([t.id for t in threads]))
            .order_by(Message.created_at.desc()).limit(20000)
        )) or []
    subs = await _safe("subscriptions", _all(
        select(Subscription).where(Subscription.user_id == uid).order_by(Subscription.created_at.desc())
    ))
    credits = await _safe("credit_transactions", _all(
        select(CreditTransaction).where(CreditTransaction.user_id == uid).order_by(CreditTransaction.created_at.desc())
    ))
    notifs = await _safe("notifications", _all(
        select(Notification).where(Notification.user_id == uid).order_by(Notification.created_at.desc())
    ))
    verifs = await _safe("verifications", _all(select(Verification).where(Verification.user_id == uid)))
    consents = await _safe("consents", _all(
        select(UserConsent).where(UserConsent.user_id == uid).order_by(UserConsent.created_at.desc())
    ))
    stored_settings = await _read_account_settings(db, uid)

    def _counterparty(a, b):
        return str(b if a == uid else a)

    export = {
        "export_format": "match4marriage.personal-data.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "notes": (
            "Personal data held about you by Match4Marriage. Message bodies are "
            "end-to-end encrypted and not included; message metadata is. Other "
            "members are referenced by opaque ID only."
        ),
        "account": _row_dict(user, _EXPORT_USER_EXCLUDE),
        "settings": {
            "notifications": _notification_prefs(stored_settings),
        },
        "profile": _row_dict(profile[0]) if profile else None,
        "interests": [
            {**_row_dict(i), "direction": "sent" if i.sender_id == uid else "received"}
            for i in (interests or [])
        ],
        "matches": [
            {**_row_dict(m), "other_member_id": _counterparty(m.user_a_id, m.user_b_id)}
            for m in (matches or [])
        ],
        "chat_threads": [
            {
                "id": str(t.id),
                "other_member_id": _counterparty(t.user_a_id, t.user_b_id),
                "is_active": t.is_active,
                "created_at": _json_safe(t.created_at),
                "last_message_at": _json_safe(t.last_message_at),
            }
            for t in threads
        ],
        "messages_metadata": [
            {
                "id": str(m.id),
                "thread_id": str(m.thread_id),
                "direction": "sent" if m.sender_id == uid else "received",
                "type": _json_safe(m.message_type),
                "sent_at": _json_safe(m.created_at),
                "delivered_at": _json_safe(m.delivered_at),
                "read_at": _json_safe(m.read_at),
            }
            for m in messages
        ],
        "subscriptions": [_row_dict(s, {"raw_webhook_data"}) for s in (subs or [])],
        "credit_transactions": [_row_dict(c) for c in (credits or [])],
        "notifications": [_row_dict(n) for n in (notifs or [])],
        "verifications": [_row_dict(v) for v in (verifs or [])],
        "consents": [_row_dict(c) for c in (consents or [])],
    }
    return export


@router.get("/me/export", response_model=APIResponse[dict])
@limiter.limit("5/hour")
async def export_my_data(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Download a copy of the member's personal data as JSON: account, profile,
    interests, matches, chat threads + message METADATA (no message bodies),
    subscriptions & credits, notifications, verifications, consents and settings.
    """
    uid = _caller_uuid(current_user)
    export = await build_personal_data_export(db, uid)
    if export is None:
        raise HTTPException(status_code=404, detail="No account data found.")
    logger.info("gdpr_export_generated", user_id=str(uid))
    return APIResponse(success=True, data=export)


# ── Deactivate / reactivate / delete ─────────────────────────────────────────


@router.post("/deactivate", response_model=APIResponse[dict])
@limiter.limit("3/minute")
async def deactivate_account(
    request: Request,
    payload: DeactivateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Hide the account: the profile disappears from Browse/Matches (they filter
    on users.is_active) and every session is signed out. Signing in again
    reactivates it via POST /auth/reactivate. Requires a recent sign-in.
    """
    _require_recent_auth(current_user)
    uid = _caller_uuid(current_user)
    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found.")

    stored = await _read_account_settings(db, uid)
    stored["deactivation"] = {
        "at": datetime.now(timezone.utc).isoformat(),
        "by": "self",
        "reason": (payload.reason or "").strip()[:500] or None,
    }
    await _write_account_settings(db, uid, stored)
    user.is_active = False
    await db.flush()
    await db.commit()

    await _revoke_all_sessions(user, current_user.get("firebase_uid"))
    logger.info("account_deactivated", user_id=str(uid))
    if user.email:
        try:
            await send_security_notice_email(
                user.email,
                await _first_name_for(db, user),
                "Your account is deactivated",
                "Your Match4Marriage profile is now hidden from other members. "
                "Sign in at any time to reactivate it.",
            )
        except Exception:
            pass
    return APIResponse(success=True, data={"deactivated": True}, message="Your account has been deactivated.")


_optional_bearer = HTTPBearer(auto_error=False)


@router.post("/reactivate", response_model=APIResponse[dict])
@limiter.limit("5/minute")
async def reactivate_account(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(_optional_bearer)] = None,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Undo a SELF-deactivation right after the member signs in again.
    Can't use get_current_user here (it rejects inactive accounts), so the
    Firebase token is verified directly. Accounts disabled by an admin stay
    disabled.
    """
    from app.core.security import _decode_token, _find_or_link_user

    if credentials is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    claims = _decode_token(credentials.credentials)
    _require_recent_auth(claims)
    uid = await _find_or_link_user(
        db, claims["firebase_uid"], claims.get("phone_number"), claims.get("email"), tenant_slug
    )
    user = (await db.execute(
        select(User).where(User.id == uid, User.deleted_at.is_(None))
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found.")
    if user.is_active:
        return APIResponse(success=True, data={"reactivated": False, "already_active": True})

    stored = await _read_account_settings(db, uid)
    deact = stored.get("deactivation") if isinstance(stored.get("deactivation"), dict) else {}
    if deact.get("by") != "self":
        raise HTTPException(
            status_code=403,
            detail="This account has been disabled. Please contact support for help.",
        )
    stored.pop("deactivation", None)
    stored["reactivated_at"] = datetime.now(timezone.utc).isoformat()
    await _write_account_settings(db, uid, stored)
    user.is_active = True
    await db.flush()
    logger.info("account_reactivated", user_id=str(uid))
    return APIResponse(success=True, data={"reactivated": True}, message="Welcome back — your account is active again.")


@router.post("/delete-account", response_model=APIResponse[dict])
@limiter.limit("3/minute")
async def delete_account(
    request: Request,
    payload: DeleteAccountRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Soft-delete the member's account. Requires typing DELETE plus a recent
    sign-in (password re-auth on the client).

    - users.deleted_at / profiles.deleted_at set; users.is_active = false
    - email/phone moved into account_settings.deletion (a restorable tombstone)
      and nulled on the row, so the unique (tenant, email|phone) constraints
      don't block the person from registering again later
    - Firebase sign-in identities are deleted so the old credentials stop
      working (the DB row remains for the retention period)
    """
    from app.models.user import UserProfile

    _require_recent_auth(current_user)
    uid = _caller_uuid(current_user)
    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found.")

    now = datetime.now(timezone.utc)
    old_email, old_phone = user.email, user.phone
    name = await _first_name_for(db, user)

    stored = await _read_account_settings(db, uid)
    stored["deletion"] = {
        "at": now.isoformat(),
        "by": "self",
        "reason": (payload.reason or "").strip()[:500] or None,
        "email": old_email,
        "phone": old_phone,
    }
    await _write_account_settings(db, uid, stored)

    profile = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == uid)
    )).scalar_one_or_none()
    if profile is not None and profile.deleted_at is None:
        profile.deleted_at = now
    fb_uids = set(user.firebase_uids or [])
    if current_user.get("firebase_uid"):
        fb_uids.add(current_user["firebase_uid"])
    user.email = None
    user.phone = None
    user.is_active = False
    user.deleted_at = now
    await db.flush()
    # Commit BEFORE touching Firebase so we never delete the sign-in identity
    # of an account whose DB soft-delete then failed to persist.
    await db.commit()

    from app.core.firebase import get_firebase_app
    fb_app = get_firebase_app()
    if fb_app is not None and fb_uids:
        from firebase_admin import auth as fb_auth
        for fu in fb_uids:
            try:
                await asyncio.to_thread(fb_auth.delete_user, fu, fb_app)
            except Exception as exc:
                logger.warning("firebase_delete_user_failed", error=str(exc))

    logger.info("account_deleted", user_id=str(uid))
    if old_email:
        try:
            await send_security_notice_email(
                old_email,
                name,
                "Your account has been deleted",
                "Your Match4Marriage account and profile have been deleted, as you requested. "
                "Your profile is no longer visible to anyone. Thank you for being part of our community.",
            )
        except Exception:
            pass
    return APIResponse(success=True, data={"deleted": True}, message="Your account has been deleted.")
