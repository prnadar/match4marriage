"""
Auth router — registration, OTP, profile bootstrap, email verification.
POST /api/v1/auth/register
POST /api/v1/auth/verify-otp
POST /api/v1/auth/resend-otp
POST /api/v1/auth/send-verification-email
GET  /api/v1/auth/verify-email
"""
import random
import secrets
import string
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.core.redis import get_redis
from app.core.security import get_current_user
from app.core.tenancy import get_current_tenant_slug

settings = get_settings()
from app.models.user import User
from app.schemas.auth import EmailRegisterRequest, FirebaseVerifyRequest, OTPVerifyRequest, RegisterRequest, TokenResponse
from app.schemas.common import APIResponse
from app.services.email import send_verification_email, send_welcome_email
from app.services.otp import send_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)

# ── Token constants ───────────────────────────────────────────────────────────
_EMAIL_TOKEN_LEN     = 6
_EMAIL_TOKEN_TTL_SEC = 600   # 10 minutes
_EMAIL_TOKEN_PREFIX  = "email_verify:"


def _generate_email_token() -> str:
    """Generate a 6-character uppercase alphanumeric token."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(_EMAIL_TOKEN_LEN))


# ── Existing endpoints ────────────────────────────────────────────────────────


@router.post("/register", response_model=APIResponse[dict])
async def register(
    payload: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Start registration with phone OTP.
    Creates user record if new. Sends OTP via Twilio.
    Rate limited to 10/minute per phone number.
    """
    sent = await send_otp(payload.phone, payload.country_code, tenant_slug)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send OTP. Try again in a moment.",
        )
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
    try:
        import uuid as _uuid
        db_user = (await db.execute(
            select(User).where(User.id == _uuid.UUID(str(user_id)))
        )).scalar_one_or_none()
        if db_user:
            email = email or db_user.email
            phone = phone or db_user.phone
    except Exception:
        pass

    return APIResponse(
        success=True,
        data={
            "user_id": str(user_id) if user_id else None,
            "email": email,
            "phone": phone,
            "roles": roles,
            "is_admin": "admin" in roles or "super_admin" in roles,
            "is_super_admin": "super_admin" in roles,
        },
    )


@router.post("/resend-otp", response_model=APIResponse[None])
async def resend_otp(
    payload: RegisterRequest,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    sent = await send_otp(payload.phone, payload.country_code, tenant_slug)
    if not sent:
        raise HTTPException(status_code=503, detail="Could not resend OTP")
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


@router.post("/send-verification-email", response_model=APIResponse[dict])
async def send_verification_email_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
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

    result = await db.execute(
        select(User).where(User.id == user_uuid, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

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

    # Store token in Redis: key → user_id
    redis = await get_redis()
    redis_key = f"{_EMAIL_TOKEN_PREFIX}{token}"
    await redis.setex(redis_key, _EMAIL_TOKEN_TTL_SEC, str(user_uuid))

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
async def verify_email_endpoint(
    token: str = Query(..., min_length=6, max_length=6, description="6-character verification token"),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """
    Verify an email address using the 6-character token from the verification email.

    On success:
    - Sets User.is_email_verified = True
    - Increments trust_score by +5
    - Deletes the token from Redis (single-use)
    - Sends a welcome email
    """
    import uuid

    redis = await get_redis()
    redis_key = f"{_EMAIL_TOKEN_PREFIX}{token.upper()}"

    user_id_str: str | None = await redis.get(redis_key)

    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token data corrupted — please request a new verification email",
        )

    result = await db.execute(
        select(User).where(User.id == user_uuid, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.is_email_verified:
        # Token was already used — delete it and return success
        await redis.delete(redis_key)
        return APIResponse(
            success=True,
            data={"email_verified": True},
            message="Email already verified",
        )

    # Mark as verified
    user.is_email_verified = True
    user.trust_score = (user.trust_score or 0) + 5     # email verification trust boost
    await db.flush()

    # Consume token — single-use
    await redis.delete(redis_key)

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
