"""
Member consent records (UK GDPR Art. 7 / Art. 9(2)(a), PECR).

GET  /consents/me   — the caller's current consent state + whether they still
                      need to confirm the current policy version
POST /consents      — record one or more consent decisions

Design notes
- Append-only: every decision is a new row (see app.models.consent).
- Fail-open for members: if the table isn't there yet (boot DDL hasn't run) the
  GET reports "nothing needed" rather than nagging or erroring, and the POST
  returns 503 so the client can retry later. Nothing here ever blocks login,
  browsing or messaging.
"""

import uuid
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.core.security import get_current_user
from app.core.tenancy import get_current_tenant_slug
from app.models.consent import UserConsent
from app.schemas.common import APIResponse

logger = get_logger(__name__)
router = APIRouter(prefix="/consents", tags=["consents"])

# Bump when the Terms / Privacy Policy / sensitive-data wording materially
# changes — members are then asked to confirm again (non-blocking prompt).
POLICY_VERSION = "2026-11-25"

# Consents a member must hold (at POLICY_VERSION) to be considered up to date.
REQUIRED_TYPES = ("terms_privacy", "sensitive_data")
CONSENT_TYPES = ("terms_privacy", "sensitive_data", "marketing_email")

ConsentType = Literal["terms_privacy", "sensitive_data", "marketing_email"]


class ConsentDecisions(BaseModel):
    consents: dict[ConsentType, bool] = Field(min_length=1)
    source: Literal["signup", "reconsent_prompt", "settings"] = "reconsent_prompt"


def _caller_uuid(current_user: dict) -> uuid.UUID:
    try:
        return uuid.UUID(str(current_user.get("sub") or current_user.get("user_id") or ""))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")


def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    return request.client.host[:64] if request.client else None


async def _latest_by_type(db: AsyncSession, user_id: uuid.UUID) -> dict[str, UserConsent]:
    rows = (await db.execute(
        select(UserConsent)
        .where(UserConsent.user_id == user_id, UserConsent.deleted_at.is_(None))
        .order_by(UserConsent.created_at.asc())
    )).scalars().all()
    latest: dict[str, UserConsent] = {}
    for r in rows:  # ascending → last write wins
        latest[r.consent_type] = r
    return latest


async def record_consents(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    decisions: dict[str, bool],
    source: str,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Append one row per decision. Raises on DB failure (caller decides)."""
    for ctype, granted in decisions.items():
        if ctype not in CONSENT_TYPES:
            continue
        db.add(UserConsent(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            consent_type=ctype,
            granted=bool(granted),
            policy_version=POLICY_VERSION,
            source=source,
            ip_address=ip,
            user_agent=(user_agent or "")[:300] or None,
        ))
    await db.flush()


@router.get("/me", response_model=APIResponse[dict])
async def my_consents(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    uid = _caller_uuid(current_user)
    try:
        async with db.begin_nested():
            latest = await _latest_by_type(db, uid)
    except Exception as exc:  # table missing / transient — never nag or block
        logger.warning("consents_read_failed", error=str(exc))
        return APIResponse(success=True, data={
            "policy_version": POLICY_VERSION, "consents": {}, "needs_consent": False,
        })

    out = {
        t: {
            "granted": r.granted,
            "policy_version": r.policy_version,
            "at": r.created_at.isoformat() if r.created_at else None,
            "source": r.source,
        }
        for t, r in latest.items()
    }
    needs = any(
        not (latest.get(t) and latest[t].granted and latest[t].policy_version == POLICY_VERSION)
        for t in REQUIRED_TYPES
    )
    return APIResponse(success=True, data={
        "policy_version": POLICY_VERSION, "consents": out, "needs_consent": needs,
    })


@router.post("", response_model=APIResponse[dict])
@limiter.limit("20/minute")
async def save_consents(
    request: Request,
    payload: ConsentDecisions,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    # Local imports: auth.py is large and imports a lot; keep module load light
    # and avoid any import cycle.
    from app.routers.auth import (
        _ensure_auth_user, _notification_prefs, _read_account_settings, _write_account_settings,
    )

    user = await _ensure_auth_user(db, current_user, tenant_slug)

    async def _write() -> None:
        async with db.begin_nested():
            await record_consents(
                db,
                user_id=user.id,
                tenant_id=user.tenant_id,
                decisions=dict(payload.consents),
                source=payload.source,
                ip=_client_ip(request),
                user_agent=request.headers.get("user-agent"),
            )

    try:
        await _write()
    except Exception as first_exc:
        # Table may not exist yet (e.g. RUN_BOOT_DDL=false). Create it on first
        # use — new table only, no locks on existing tables — and retry once.
        logger.warning("consents_write_retry", error=str(first_exc))
        try:
            from app.main import _ensure_consent_table
            await _ensure_consent_table()
            await _write()
        except Exception as exc:
            logger.error("consents_write_failed", error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Couldn't save your choices right now. Please try again shortly.",
            )

    # Keep the "News & offers" email preference in Settings in sync.
    if "marketing_email" in payload.consents:
        try:
            stored = await _read_account_settings(db, user.id)
            prefs = _notification_prefs(stored)
            prefs["email_marketing"] = bool(payload.consents["marketing_email"])
            stored["notifications"] = prefs
            stored["notifications_updated_at"] = datetime.now(timezone.utc).isoformat()
            await _write_account_settings(db, user.id, stored)
        except Exception as exc:  # consent row is the source of truth; don't fail
            logger.warning("consent_marketing_pref_sync_failed", error=str(exc))

    await db.commit()
    return APIResponse(success=True, data={"policy_version": POLICY_VERSION}, message="Thank you — your choices are saved.")
