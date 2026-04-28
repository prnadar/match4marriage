"""
Success stories — public read + admin CRUD.

Public:
  GET    /api/v1/public/success-stories            (active, published; tenant-scoped)

Admin:
  GET    /api/v1/admin/success-stories             (all, including unpublished)
  POST   /api/v1/admin/success-stories             create
  PUT    /api/v1/admin/success-stories/{id}        update (also toggles publish)
  POST   /api/v1/admin/success-stories/{id}/publish  flip publish state safely
  DELETE /api/v1/admin/success-stories/{id}        soft-delete

Stories may only be published if `consent_signed_at` is set — protects against
accidental publishing of a draft from a couple who hasn't consented in writing.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user, has_admin_role
from app.core.tenancy import get_current_tenant_slug
from app.models.success_story import SuccessStory
from app.schemas.common import APIResponse
from app.schemas.success_story import (
    SuccessStoryRead,
    SuccessStoryAdminRead,
    SuccessStoryWrite,
)

router = APIRouter(tags=["success-stories"])
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


# ── Public ───────────────────────────────────────────────────────────────────

@router.get("/public/success-stories", response_model=APIResponse[list[SuccessStoryRead]])
async def list_public(
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    limit: int = 24,
):
    """Active, published success stories — public, no auth."""
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    rows = (await db.execute(
        select(SuccessStory)
        .where(
            SuccessStory.tenant_id == tenant_uuid,
            SuccessStory.deleted_at.is_(None),
            SuccessStory.is_published == True,  # noqa: E712
        )
        .order_by(SuccessStory.sort_order.asc(), SuccessStory.year_married.desc())
        .limit(max(1, min(limit, 100)))
    )).scalars().all()
    return APIResponse(success=True, data=[
        SuccessStoryRead.model_validate(r, from_attributes=True) for r in rows
    ])


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin/success-stories", response_model=APIResponse[list[SuccessStoryAdminRead]])
async def list_admin(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    rows = (await db.execute(
        select(SuccessStory)
        .where(
            SuccessStory.tenant_id == tenant_uuid,
            SuccessStory.deleted_at.is_(None),
        )
        .order_by(SuccessStory.sort_order.asc(), SuccessStory.created_at.desc())
    )).scalars().all()
    return APIResponse(success=True, data=[
        SuccessStoryAdminRead.model_validate(r, from_attributes=True) for r in rows
    ])


@router.post("/admin/success-stories", response_model=APIResponse[SuccessStoryAdminRead])
async def create(
    body: SuccessStoryWrite,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    # Required-on-create — guard with explicit checks for clearer errors than
    # SQL NOT NULL violations.
    missing: list[str] = []
    if not body.couple_names: missing.append("couple_names")
    if not body.headline:     missing.append("headline")
    if not body.body:         missing.append("body")
    if body.year_married is None: missing.append("year_married")
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required: {', '.join(missing)}")

    if body.is_published and not body.consent_signed_at:
        raise HTTPException(
            status_code=400,
            detail="Cannot publish without consent_signed_at. Record consent first.",
        )

    admin_id_raw = current_user.get("sub", "")
    try: admin_uuid = uuid.UUID(admin_id_raw)
    except (ValueError, TypeError): admin_uuid = None

    story = SuccessStory(
        tenant_id=tenant_uuid,
        couple_names=body.couple_names,
        location=body.location,
        year_married=body.year_married,
        headline=body.headline,
        body=body.body,
        quote=body.quote,
        photo_key=body.photo_key,
        photo_url=body.photo_url,
        is_published=bool(body.is_published),
        sort_order=int(body.sort_order or 0),
        consent_signed_at=body.consent_signed_at,
        notes=body.notes,
        submitted_by_admin_id=admin_uuid,
    )
    db.add(story)
    await db.commit()
    await db.refresh(story)
    return APIResponse(success=True, data=SuccessStoryAdminRead.model_validate(story, from_attributes=True))


@router.put("/admin/success-stories/{story_id}", response_model=APIResponse[SuccessStoryAdminRead])
async def update(
    story_id: uuid.UUID,
    body: SuccessStoryWrite,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    story = (await db.execute(
        select(SuccessStory).where(
            SuccessStory.id == story_id,
            SuccessStory.tenant_id == tenant_uuid,
            SuccessStory.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Success story not found")

    update_fields = body.model_dump(exclude_unset=True)
    # Same publish-without-consent guard as create.
    target_is_published = update_fields.get("is_published", story.is_published)
    target_consent      = update_fields.get("consent_signed_at", story.consent_signed_at)
    if target_is_published and not target_consent:
        raise HTTPException(
            status_code=400,
            detail="Cannot publish without consent_signed_at. Record consent first.",
        )

    for k, v in update_fields.items():
        setattr(story, k, v)
    await db.commit()
    await db.refresh(story)
    return APIResponse(success=True, data=SuccessStoryAdminRead.model_validate(story, from_attributes=True))


@router.post("/admin/success-stories/{story_id}/publish", response_model=APIResponse[SuccessStoryAdminRead])
async def toggle_publish(
    story_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    story = (await db.execute(
        select(SuccessStory).where(
            SuccessStory.id == story_id,
            SuccessStory.tenant_id == tenant_uuid,
            SuccessStory.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Success story not found")
    if not story.is_published and not story.consent_signed_at:
        raise HTTPException(
            status_code=400,
            detail="Cannot publish without consent_signed_at. Record consent first.",
        )
    story.is_published = not story.is_published
    await db.commit()
    await db.refresh(story)
    return APIResponse(success=True, data=SuccessStoryAdminRead.model_validate(story, from_attributes=True))


@router.delete("/admin/success-stories/{story_id}", response_model=APIResponse[dict])
async def soft_delete(
    story_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    story = (await db.execute(
        select(SuccessStory).where(
            SuccessStory.id == story_id,
            SuccessStory.tenant_id == tenant_uuid,
            SuccessStory.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Success story not found")
    story.deleted_at = datetime.now(timezone.utc)
    story.is_published = False
    await db.commit()
    return APIResponse(success=True, data={"id": str(story_id), "deleted": True})
