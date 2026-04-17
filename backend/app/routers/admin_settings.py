"""
Admin: site-wide settings (single-row per tenant).

Future PRs add SEO settings, mail templates, appearance, payment gateway —
each as its own router. This file owns the "Site" tab only.
"""
from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user, has_admin_role
from app.core.tenancy import get_current_tenant_slug
from app.models.site_setting import SiteSetting
from app.schemas.common import APIResponse

router = APIRouter(tags=["admin-settings"])
logger = get_logger(__name__)


def _require_admin(current_user: dict) -> None:
    if not has_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin required")


async def _tenant_uuid(db: AsyncSession, tenant_slug: str) -> uuid.UUID:
    from app.routers.profile import _resolve_tenant_uuid
    t = await _resolve_tenant_uuid(db, tenant_slug)
    if t is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return t


async def _get_or_create(db: AsyncSession, tenant_uuid: uuid.UUID) -> SiteSetting:
    """Tenants always have exactly one row; create on first read."""
    row = (await db.execute(
        select(SiteSetting).where(SiteSetting.tenant_id == tenant_uuid)
    )).scalar_one_or_none()
    if row is not None:
        return row
    row = SiteSetting(tenant_id=tenant_uuid)
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return row


def _serialize(s: SiteSetting) -> dict[str, Any]:
    return {
        "site_name": s.site_name or "",
        "tagline": s.tagline,
        "support_email": s.support_email,
        "support_phone": s.support_phone,
        "timezone": s.timezone,
        "default_currency": s.default_currency,
        "default_locale": s.default_locale,
        "logo_url": s.logo_url,
        "favicon_url": s.favicon_url,
        "brand_primary": s.brand_primary,
        "brand_accent": s.brand_accent,
        "extras": dict(s.extras or {}),
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _serialize_appearance(s: SiteSetting) -> dict[str, Any]:
    return {
        "logo_url": s.logo_url,
        "favicon_url": s.favicon_url,
        "brand_primary": s.brand_primary,
        "brand_accent": s.brand_accent,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _public_view(s: SiteSetting) -> dict[str, Any]:
    """Subset safe to expose without auth (e.g. footer, support link, theme)."""
    return {
        "site_name": s.site_name or "",
        "tagline": s.tagline,
        "support_email": s.support_email,
        "logo_url": s.logo_url,
        "favicon_url": s.favicon_url,
        "brand_primary": s.brand_primary,
        "brand_accent": s.brand_accent,
    }


def _validate_hex_color(value: str | None) -> str | None:
    """Accept #RRGGBB or #RRGGBBAA (8 chars w/ alpha). Return normalised lowercase."""
    if value is None:
        return None
    v = str(value).strip().lower()
    if not v:
        return None
    if not v.startswith("#") or len(v) not in (7, 9):
        raise HTTPException(status_code=400, detail="color must be #RRGGBB or #RRGGBBAA")
    try:
        int(v[1:], 16)
    except ValueError:
        raise HTTPException(status_code=400, detail="color must be valid hex")
    return v


# ─── Admin endpoints ─────────────────────────────────────────────────────────


@router.get("/admin/settings/site", response_model=APIResponse[dict])
async def admin_get_site_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    row = await _get_or_create(db, tenant_uuid)
    return APIResponse(success=True, data=_serialize(row))


_VALID_CURRENCIES = {"INR", "USD", "GBP", "EUR", "AED", "SGD", "AUD", "CAD"}


@router.put("/admin/settings/site", response_model=APIResponse[dict])
async def admin_update_site_settings(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Partial update. Only the fields present in the body are touched.
    `extras` is merged (shallow), not replaced — pass `{"extras": {"key": null}}`
    to remove a key.
    """
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    row = await _get_or_create(db, tenant_uuid)

    if "site_name" in payload:
        v = (payload.get("site_name") or "").strip()
        if not v:
            raise HTTPException(status_code=400, detail="site_name cannot be empty")
        row.site_name = v[:120]

    if "tagline" in payload:
        v = payload.get("tagline")
        row.tagline = (v or "").strip()[:200] or None

    if "support_email" in payload:
        v = payload.get("support_email")
        v = (v or "").strip().lower() or None
        if v and "@" not in v:
            raise HTTPException(status_code=400, detail="support_email must be a valid email")
        row.support_email = v[:255] if v else None

    if "support_phone" in payload:
        v = payload.get("support_phone")
        row.support_phone = (v or "").strip()[:32] or None

    if "timezone" in payload:
        v = (payload.get("timezone") or "").strip()
        if not v:
            raise HTTPException(status_code=400, detail="timezone cannot be empty")
        row.timezone = v[:64]

    if "default_currency" in payload:
        v = (payload.get("default_currency") or "").strip().upper()
        if v not in _VALID_CURRENCIES:
            raise HTTPException(status_code=400, detail=f"default_currency must be one of {sorted(_VALID_CURRENCIES)}")
        row.default_currency = v

    if "default_locale" in payload:
        v = (payload.get("default_locale") or "").strip()
        if not v:
            raise HTTPException(status_code=400, detail="default_locale cannot be empty")
        row.default_locale = v[:10]

    if "extras" in payload:
        incoming = payload.get("extras") or {}
        if not isinstance(incoming, dict):
            raise HTTPException(status_code=400, detail="extras must be an object")
        merged = dict(row.extras or {})
        for k, v in incoming.items():
            if v is None:
                merged.pop(k, None)
            else:
                merged[k] = v
        row.extras = merged

    await db.flush()
    await db.refresh(row)
    logger.info("admin_update_site_settings", admin=current_user.get("sub"), tenant=str(tenant_uuid))
    return APIResponse(success=True, data=_serialize(row))


# ─── Appearance ──────────────────────────────────────────────────────────────


@router.get("/admin/settings/appearance", response_model=APIResponse[dict])
async def admin_get_appearance(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    row = await _get_or_create(db, tenant_uuid)
    return APIResponse(success=True, data=_serialize_appearance(row))


@router.put("/admin/settings/appearance", response_model=APIResponse[dict])
async def admin_update_appearance(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Partial update of logo + colors. Set a value to null to clear it."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    row = await _get_or_create(db, tenant_uuid)

    if "logo_url" in payload:
        v = payload.get("logo_url")
        row.logo_url = (str(v).strip()[:500] or None) if v else None

    if "favicon_url" in payload:
        v = payload.get("favicon_url")
        row.favicon_url = (str(v).strip()[:500] or None) if v else None

    if "brand_primary" in payload:
        row.brand_primary = _validate_hex_color(payload.get("brand_primary"))

    if "brand_accent" in payload:
        row.brand_accent = _validate_hex_color(payload.get("brand_accent"))

    await db.flush()
    await db.refresh(row)
    logger.info("admin_update_appearance", admin=current_user.get("sub"), tenant=str(tenant_uuid))
    return APIResponse(success=True, data=_serialize_appearance(row))


# ─── Public endpoint ─────────────────────────────────────────────────────────


@router.get("/settings/public", response_model=APIResponse[dict])
async def public_site_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """No auth — surfaces only the fields safe to expose to anyone."""
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    row = await _get_or_create(db, tenant_uuid)
    return APIResponse(success=True, data=_public_view(row))
