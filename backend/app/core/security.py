"""
Auth: Firebase ID token verification.
Frontend signs the user in via Firebase (phone/email/google), sends the ID token
as `Authorization: Bearer <idToken>`. We verify via firebase-admin and extract
the uid to look up the user row.
"""
import uuid
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.firebase import verify_firebase_id_token
from app.core.logging import get_logger

logger = get_logger(__name__)
bearer_scheme = HTTPBearer()

# Deterministic mapping: Firebase UID (string) -> UUID (stable across calls).
# DB user_id/profile.user_id columns are UUID, Firebase UIDs aren't.
_FIREBASE_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # RFC 4122 DNS namespace


def firebase_uid_to_uuid(firebase_uid: str) -> uuid.UUID:
    return uuid.uuid5(_FIREBASE_NAMESPACE, firebase_uid)


def _decode_token(token: str) -> dict[str, Any]:
    try:
        claims = verify_firebase_id_token(token)
    except Exception as exc:
        logger.warning("firebase_token_invalid", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    uid = claims.get("uid") or claims.get("sub")
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing uid")
    # Map Firebase UID (opaque string) to a deterministic UUID for DB columns.
    db_uuid = str(firebase_uid_to_uuid(uid))
    claims["firebase_uid"] = uid
    claims["user_id"] = db_uuid
    claims["sub"] = db_uuid
    return claims


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Security(bearer_scheme)],
) -> dict[str, Any]:
    return _decode_token(credentials.credentials)


async def require_admin(
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    # Firebase custom claims set via admin SDK: { roles: ["admin"] }
    roles: list[str] = user.get("roles", []) or user.get("https://bandhan.in/roles", [])
    if "admin" not in roles and "super_admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return user


async def require_super_admin(
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    roles: list[str] = user.get("roles", []) or user.get("https://bandhan.in/roles", [])
    if "super_admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super-admin required")
    return user
