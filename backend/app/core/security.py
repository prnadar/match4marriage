"""
Auth: Firebase ID token verification + user resolution.
Frontend signs the user in via Firebase (phone/email/google), sends the ID token
as `Authorization: Bearer <idToken>`. We verify via firebase-admin and extract
the uid to look up or create the user row.

Identity unification:
- A single user may sign in via multiple Firebase methods (phone, email, google).
  Each produces a different Firebase UID, but they are the same person.
- We link them by phone/email on the claims. firebase_uids[] on User stores
  every UID that has been associated with this user.
- A User.id is a fresh UUID; it does NOT derive from the Firebase UID.
"""
import re
import uuid
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, or_, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.firebase import verify_firebase_id_token
from app.core.logging import get_logger
from app.core.tenancy import get_current_tenant_slug

logger = get_logger(__name__)
bearer_scheme = HTTPBearer()

# Legacy deterministic mapping — kept for backwards compatibility with any
# existing rows whose User.id was derived from the Firebase UID. We no longer
# mint new IDs this way.
_FIREBASE_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def firebase_uid_to_uuid(firebase_uid: str) -> uuid.UUID:
    """Legacy deterministic UUID — kept so old rows can still be found."""
    return uuid.uuid5(_FIREBASE_NAMESPACE, firebase_uid)


def _normalize_phone(raw: str | None) -> str | None:
    """Strip country code and non-digits. Matches how User.phone is stored."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    # Drop leading country code for India/UK if the number is longer than 10 digits.
    # (Historical rows were saved as 10-digit local — keep compatibility.)
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("44") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("1") and len(digits) == 11:
        digits = digits[1:]
    return digits or None


def _decode_token(token: str) -> dict[str, Any]:
    """Verify Firebase ID token and return claims. Does NOT resolve DB user."""
    try:
        claims = verify_firebase_id_token(token)
    except ValueError as exc:
        # Firebase not configured on server
        logger.error("firebase_not_configured", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        ) from exc
    except Exception as exc:
        # Token expired, revoked, malformed, or signature mismatch
        msg = str(exc)
        if "expired" in msg.lower():
            detail = "Token expired. Please sign in again."
        elif "revoked" in msg.lower():
            detail = "Session revoked. Please sign in again."
        else:
            detail = "Invalid authentication token"
        logger.warning("firebase_token_invalid", error=msg)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    uid = claims.get("uid") or claims.get("sub")
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing uid")
    claims["firebase_uid"] = uid
    return claims


async def _find_or_link_user(
    db: AsyncSession,
    firebase_uid: str,
    phone: str | None,
    email: str | None,
    tenant_slug: str,
) -> "uuid.UUID":
    """
    Resolve the User UUID for these Firebase claims.
    Match order: firebase_uids[] → phone → email → legacy deterministic UUID.
    If found by phone/email but firebase_uid is new, link it.
    Does NOT create a new user row — profile router handles first-time create.
    """
    from app.models.user import User

    # 1. Firebase UID already linked.
    # We use a raw JSONB containment query on Postgres; SQLite falls back to
    # a scan. Wrap in a SAVEPOINT so a missing-column or dialect error here
    # does not poison the caller's request transaction.
    try:
        async with db.begin_nested():
            rows = (await db.execute(
                sa_text(
                    "SELECT id FROM users "
                    "WHERE firebase_uids @> :uid::jsonb "
                    "AND deleted_at IS NULL LIMIT 1"
                ),
                {"uid": f'["{firebase_uid}"]'},
            )).fetchone()
        if rows:
            return rows[0]
    except Exception as exc:
        # JSONB op unavailable or column not yet migrated — keep going.
        logger.debug("firebase_uid_jsonb_lookup_skipped", error=str(exc))

    # 2. Match on phone or email — same savepoint pattern so a stale schema
    # doesn't poison the request transaction.
    norm_phone = _normalize_phone(phone)
    match_user: User | None = None
    try:
        async with db.begin_nested():
            if norm_phone or email:
                clauses = []
                if norm_phone:
                    clauses.append(User.phone == norm_phone)
                if email:
                    clauses.append(func.lower(User.email) == email.lower())
                result = await db.execute(
                    select(User).where(
                        or_(*clauses),
                        User.deleted_at.is_(None),
                    ).limit(1)
                )
                match_user = result.scalar_one_or_none()

            # 3. Legacy: user previously bootstrapped with deterministic UUID from UID
            if match_user is None:
                legacy_id = firebase_uid_to_uuid(firebase_uid)
                result = await db.execute(
                    select(User).where(User.id == legacy_id, User.deleted_at.is_(None))
                )
                match_user = result.scalar_one_or_none()
    except Exception as exc:
        logger.warning("identity_lookup_failed", error=str(exc))
        match_user = None

    if match_user is not None:
        # Link this Firebase UID to the existing user. Savepoint so a write
        # failure here (e.g. firebase_uids column missing) cannot abort the
        # outer transaction — we'll link on a later request.
        try:
            async with db.begin_nested():
                uids = list(getattr(match_user, "firebase_uids", None) or [])
                if firebase_uid not in uids:
                    uids.append(firebase_uid)
                    match_user.firebase_uids = uids
                    await db.flush()
        except Exception as exc:
            logger.debug("firebase_uid_link_skipped", error=str(exc))
        return match_user.id

    # 4. No user yet — return the legacy deterministic UUID as a placeholder.
    # The profile router will create the row on first request using this ID
    # and link the Firebase UID onto it.
    return firebase_uid_to_uuid(firebase_uid)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
) -> dict[str, Any]:
    """
    Verify Firebase token and return a claims dict augmented with:
    - firebase_uid: the Firebase UID
    - user_id / sub: the canonical User.id (UUID) for this person
    - phone / email: normalized claims

    Rejects soft-deleted users with 401.
    """
    # Run the schema guard on first access — Vercel cold starts may skip the
    # FastAPI lifespan, so guard against the `firebase_uids` column being missing.
    from app.routers.profile import _run_schema_guard_once
    try:
        await _run_schema_guard_once(db)
    except Exception as exc:
        logger.warning("schema_guard_from_security_failed", error=str(exc))

    claims = _decode_token(credentials.credentials)
    firebase_uid = claims["firebase_uid"]
    phone = claims.get("phone_number") or claims.get("phone")
    email = claims.get("email")

    user_uuid = await _find_or_link_user(db, firebase_uid, phone, email, tenant_slug)

    # Reject soft-deleted users
    from app.models.user import User
    existing = (
        await db.execute(
            select(User).where(User.id == user_uuid).limit(1)
        )
    ).scalar_one_or_none()
    if existing is not None and existing.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is no longer active",
        )
    if existing is not None and not existing.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    claims["user_id"] = str(user_uuid)
    claims["sub"] = str(user_uuid)
    claims["phone"] = _normalize_phone(phone)
    if email:
        claims["email"] = email.lower()
    return claims


def _roles_from_claims(claims: dict[str, Any]) -> list[str]:
    """Robust role extraction: claims.roles may be list, comma string, or namespaced."""
    candidates = (
        claims.get("roles"),
        claims.get("role"),
        claims.get("https://bandhan.in/roles"),
        claims.get("https://match4marriage.com/roles"),
    )
    for c in candidates:
        if isinstance(c, list):
            return [str(r).lower() for r in c]
        if isinstance(c, str) and c.strip():
            return [r.strip().lower() for r in c.split(",") if r.strip()]
    return []


def has_admin_role(claims: dict[str, Any]) -> bool:
    roles = _roles_from_claims(claims)
    return "admin" in roles or "super_admin" in roles


def has_super_admin_role(claims: dict[str, Any]) -> bool:
    return "super_admin" in _roles_from_claims(claims)


async def require_admin(
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    if not has_admin_role(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return user


async def require_super_admin(
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    if not has_super_admin_role(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super-admin required")
    return user
