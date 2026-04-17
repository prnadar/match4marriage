"""
Admin: mail templates + SEO settings.

Both surfaces are tenant-scoped CRUD. Mail templates are keyed; SEO settings
are keyed by URL path.
"""
from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user, has_admin_role
from app.core.tenancy import get_current_tenant_slug
from app.models.mail_template import MailTemplate
from app.models.seo_setting import SeoSetting
from app.schemas.common import APIResponse

router = APIRouter(tags=["admin-cms"])
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


# ─── Mail templates ──────────────────────────────────────────────────────────

# Built-in template keys. Admins see these as the recommended catalogue.
BUILTIN_MAIL_TEMPLATES = [
    {"key": "welcome",                  "name": "Welcome (post-signup)"},
    {"key": "verification_approved",    "name": "Profile verification approved"},
    {"key": "verification_rejected",    "name": "Profile verification rejected"},
    {"key": "renewal_reminder",         "name": "Subscription renewal reminder"},
    {"key": "password_reset",           "name": "Password reset"},
    {"key": "interest_received",        "name": "New interest received"},
    {"key": "match_accepted",           "name": "Match accepted"},
]


def _serialize_mail(t: MailTemplate) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "key": t.key,
        "name": t.name,
        "subject": t.subject,
        "body_html": t.body_html,
        "body_text": t.body_text,
        "is_active": bool(t.is_active),
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/admin/mail-templates", response_model=APIResponse[dict])
async def list_mail_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Returns: { templates: [...stored rows...], builtins: [...recommended keys...] }
    The frontend merges them so admins see the full catalogue with current state.
    """
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    rows = (await db.execute(
        select(MailTemplate)
        .where(MailTemplate.tenant_id == tenant_uuid, MailTemplate.deleted_at.is_(None))
        .order_by(MailTemplate.key.asc())
    )).scalars().all()
    return APIResponse(success=True, data={
        "templates": [_serialize_mail(t) for t in rows],
        "builtins": BUILTIN_MAIL_TEMPLATES,
    })


@router.put("/admin/mail-templates/{key}", response_model=APIResponse[dict])
async def upsert_mail_template(
    key: str,
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Create-or-update a template by key. Body: {name, subject, body_html, body_text?, is_active?}."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)

    key_clean = (key or "").strip().lower()
    if not key_clean or not all(c.isalnum() or c in "-_" for c in key_clean):
        raise HTTPException(status_code=400, detail="key must be alphanumeric/dash/underscore")

    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    subject = (payload.get("subject") or "").strip()
    if not subject:
        raise HTTPException(status_code=400, detail="subject is required")

    body_html = (payload.get("body_html") or "").strip()
    if not body_html:
        raise HTTPException(status_code=400, detail="body_html is required")

    body_text = payload.get("body_text")
    if body_text is not None:
        body_text = (str(body_text) or "").strip() or None

    is_active = bool(payload.get("is_active", True))

    row = (await db.execute(
        select(MailTemplate).where(
            MailTemplate.tenant_id == tenant_uuid,
            MailTemplate.key == key_clean,
            MailTemplate.deleted_at.is_(None),
        )
    )).scalar_one_or_none()

    if row is None:
        row = MailTemplate(
            tenant_id=tenant_uuid,
            key=key_clean, name=name[:120],
            subject=subject[:255], body_html=body_html,
            body_text=body_text, is_active=is_active,
        )
        db.add(row)
    else:
        row.name = name[:120]
        row.subject = subject[:255]
        row.body_html = body_html
        row.body_text = body_text
        row.is_active = is_active

    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Conflict on key")
    await db.refresh(row)
    logger.info("upsert_mail_template", key=key_clean, by=current_user.get("sub"))
    return APIResponse(success=True, data=_serialize_mail(row))


@router.delete("/admin/mail-templates/{key}", response_model=APIResponse[dict])
async def delete_mail_template(
    key: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Soft-delete (sets deleted_at). The built-in catalogue stays available to recreate."""
    from datetime import datetime, timezone
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    row = (await db.execute(
        select(MailTemplate).where(
            MailTemplate.tenant_id == tenant_uuid,
            MailTemplate.key == key.strip().lower(),
            MailTemplate.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    row.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    logger.info("delete_mail_template", key=row.key, by=current_user.get("sub"))
    return APIResponse(success=True, data={"key": row.key})


# ─── SEO settings ────────────────────────────────────────────────────────────

# Suggested catalogue of paths the admin should configure first.
BUILTIN_SEO_PATHS = [
    {"path": "/",                "label": "Home"},
    {"path": "/pricing",         "label": "Pricing"},
    {"path": "/about",           "label": "About" },
    {"path": "/success-stories", "label": "Success stories"},
    {"path": "/contact",         "label": "Contact"},
    {"path": "/faq",             "label": "FAQ"},
]


def _serialize_seo(s: SeoSetting) -> dict[str, Any]:
    return {
        "id": str(s.id),
        "path": s.path,
        "title": s.title,
        "description": s.description,
        "og_image_url": s.og_image_url,
        "robots": s.robots,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/admin/seo", response_model=APIResponse[dict])
async def list_seo_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    rows = (await db.execute(
        select(SeoSetting)
        .where(SeoSetting.tenant_id == tenant_uuid, SeoSetting.deleted_at.is_(None))
        .order_by(SeoSetting.path.asc())
    )).scalars().all()
    return APIResponse(success=True, data={
        "settings": [_serialize_seo(s) for s in rows],
        "builtins": BUILTIN_SEO_PATHS,
    })


_VALID_ROBOTS = {
    "index, follow", "index, nofollow",
    "noindex, follow", "noindex, nofollow",
}


@router.put("/admin/seo", response_model=APIResponse[dict])
async def upsert_seo_setting(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Upsert by path. Body: {path, title, description?, og_image_url?, robots?}.
    """
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)

    path = (payload.get("path") or "").strip()
    if not path or not path.startswith("/"):
        raise HTTPException(status_code=400, detail="path must start with '/'")

    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    description = payload.get("description")
    description = (str(description) or "").strip() or None if description is not None else None

    og_image_url = payload.get("og_image_url")
    og_image_url = (str(og_image_url) or "").strip() or None if og_image_url is not None else None

    robots = (payload.get("robots") or "index, follow").strip()
    if robots not in _VALID_ROBOTS:
        raise HTTPException(status_code=400, detail=f"robots must be one of {sorted(_VALID_ROBOTS)}")

    row = (await db.execute(
        select(SeoSetting).where(
            SeoSetting.tenant_id == tenant_uuid,
            SeoSetting.path == path,
            SeoSetting.deleted_at.is_(None),
        )
    )).scalar_one_or_none()

    if row is None:
        row = SeoSetting(
            tenant_id=tenant_uuid,
            path=path[:255], title=title[:255],
            description=description, og_image_url=og_image_url[:500] if og_image_url else None,
            robots=robots,
        )
        db.add(row)
    else:
        row.title = title[:255]
        row.description = description
        row.og_image_url = og_image_url[:500] if og_image_url else None
        row.robots = robots

    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Conflict on path")
    await db.refresh(row)
    logger.info("upsert_seo_setting", path=path, by=current_user.get("sub"))
    return APIResponse(success=True, data=_serialize_seo(row))


@router.delete("/admin/seo", response_model=APIResponse[dict])
async def delete_seo_setting(
    path: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Soft-delete by path."""
    from datetime import datetime, timezone
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    row = (await db.execute(
        select(SeoSetting).where(
            SeoSetting.tenant_id == tenant_uuid,
            SeoSetting.path == path,
            SeoSetting.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="SEO setting not found")
    row.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    logger.info("delete_seo_setting", path=path, by=current_user.get("sub"))
    return APIResponse(success=True, data={"path": path})


# ─── Public SEO read ─────────────────────────────────────────────────────────


@router.get("/seo", response_model=APIResponse[dict])
async def public_get_seo(
    path: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Returns SEO metadata for a given path or null if none configured."""
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    row = (await db.execute(
        select(SeoSetting).where(
            SeoSetting.tenant_id == tenant_uuid,
            SeoSetting.path == path,
            SeoSetting.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not row:
        return APIResponse(success=True, data=None)
    return APIResponse(success=True, data=_serialize_seo(row))
