"""
Auth: Firebase ID token verification.
Frontend signs the user in via Firebase (phone/email/google), sends the ID token
as `Authorization: Bearer <idToken>`. We verify via firebase-admin and extract
the uid to look up the user row.
"""
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.firebase import verify_firebase_id_token
from app.core.logging import get_logger

logger = get_logger(__name__)
bearer_scheme = HTTPBearer()


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
    # Normalize so existing routers that read user["user_id"] keep working.
    claims["user_id"] = uid
    claims["sub"] = uid
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
