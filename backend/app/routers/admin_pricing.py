"""
Admin: pricing plans CRUD + public listing.

Plans are tenant-scoped. Soft-delete is implemented via the inherited
`deleted_at` column on TenantModel.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user, has_admin_role
from app.core.tenancy import get_current_tenant_slug
from app.models.pricing_plan import PricingPeriod, PricingPlan
from app.schemas.common import APIResponse

router = APIRouter(tags=["admin-pricing"])
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


def _serialize(p: PricingPlan) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "key": p.key,
        "name": p.name,
        "tier": p.tier,
        "price_paise": int(p.price_paise),
        "currency": p.currency,
        "period": p.period.value if p.period else "monthly",
        "features": list(p.features or []),
        "is_active": bool(p.is_active),
        "sort_order": int(p.sort_order),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


_VALID_TIERS = {"silver", "gold", "platinum"}
_VALID_PERIODS = {p.value for p in PricingPeriod}


def _validate_payload(payload: dict, *, partial: bool = False) -> dict:
    """Validates and normalises the JSON body for create/update."""
    out: dict[str, Any] = {}

    if "key" in payload or not partial:
        key = (payload.get("key") or "").strip().lower()
        if not key:
            raise HTTPException(status_code=400, detail="key is required")
        if not all(c.isalnum() or c in "-_" for c in key):
            raise HTTPException(status_code=400, detail="key must be alphanumeric/dash/underscore")
        out["key"] = key

    if "name" in payload or not partial:
        name = (payload.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="name is required")
        out["name"] = name[:120]

    if "tier" in payload or not partial:
        tier = (payload.get("tier") or "").strip().lower()
        if tier not in _VALID_TIERS:
            raise HTTPException(status_code=400, detail=f"tier must be one of {sorted(_VALID_TIERS)}")
        out["tier"] = tier

    if "price_paise" in payload or not partial:
        try:
            price = int(payload.get("price_paise", 0))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="price_paise must be an integer")
        if price < 0:
            raise HTTPException(status_code=400, detail="price_paise must be >= 0")
        out["price_paise"] = price

    if "currency" in payload:
        cur = (payload.get("currency") or "INR").strip().upper()[:3]
        out["currency"] = cur or "INR"

    if "period" in payload or not partial:
        per = (payload.get("period") or "monthly").strip().lower()
        if per not in _VALID_PERIODS:
            raise HTTPException(status_code=400, detail=f"period must be one of {sorted(_VALID_PERIODS)}")
        out["period"] = PricingPeriod(per)

    if "features" in payload:
        feats = payload.get("features") or []
        if not isinstance(feats, list):
            raise HTTPException(status_code=400, detail="features must be a list of strings")
        out["features"] = [str(f).strip()[:200] for f in feats if str(f).strip()]

    if "is_active" in payload:
        out["is_active"] = bool(payload.get("is_active"))

    if "sort_order" in payload:
        try:
            out["sort_order"] = int(payload.get("sort_order", 100))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="sort_order must be an integer")

    return out


# ─── Admin endpoints ─────────────────────────────────────────────────────────


@router.get("/admin/pricing-plans", response_model=APIResponse[list[dict]])
async def admin_list_plans(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    include_inactive: bool = True,
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    q = (
        select(PricingPlan)
        .where(PricingPlan.tenant_id == tenant_uuid)
        .where(PricingPlan.deleted_at.is_(None))
    )
    if not include_inactive:
        q = q.where(PricingPlan.is_active == True)  # noqa: E712
    q = q.order_by(PricingPlan.sort_order.asc(), PricingPlan.created_at.asc())
    rows = (await db.execute(q)).scalars().all()
    return APIResponse(success=True, data=[_serialize(p) for p in rows])


@router.post("/admin/pricing-plans", response_model=APIResponse[dict])
async def admin_create_plan(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    data = _validate_payload(payload, partial=False)
    plan = PricingPlan(
        tenant_id=tenant_uuid,
        key=data["key"],
        name=data["name"],
        tier=data["tier"],
        price_paise=data["price_paise"],
        currency=data.get("currency", "INR"),
        period=data["period"],
        features=data.get("features", []),
        is_active=data.get("is_active", True),
        sort_order=data.get("sort_order", 100),
    )
    db.add(plan)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409, detail=f"A plan with key {data['key']!r} already exists")
    await db.refresh(plan)
    logger.info("admin_create_pricing_plan", admin=current_user.get("sub"), plan_id=str(plan.id), key=plan.key)
    return APIResponse(success=True, data=_serialize(plan))


@router.put("/admin/pricing-plans/{plan_id}", response_model=APIResponse[dict])
async def admin_update_plan(
    plan_id: uuid.UUID,
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    plan = (await db.execute(
        select(PricingPlan).where(
            PricingPlan.id == plan_id,
            PricingPlan.tenant_id == tenant_uuid,
            PricingPlan.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    data = _validate_payload(payload, partial=True)
    for k, v in data.items():
        setattr(plan, k, v)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Key collision with another plan")
    await db.refresh(plan)
    logger.info("admin_update_pricing_plan", admin=current_user.get("sub"), plan_id=str(plan.id))
    return APIResponse(success=True, data=_serialize(plan))


@router.delete("/admin/pricing-plans/{plan_id}", response_model=APIResponse[dict])
async def admin_delete_plan(
    plan_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Soft-delete (sets deleted_at). The row is preserved for audit."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    plan = (await db.execute(
        select(PricingPlan).where(
            PricingPlan.id == plan_id,
            PricingPlan.tenant_id == tenant_uuid,
            PricingPlan.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.deleted_at = datetime.now(timezone.utc)
    plan.is_active = False
    await db.flush()
    logger.info("admin_delete_pricing_plan", admin=current_user.get("sub"), plan_id=str(plan_id))
    return APIResponse(success=True, data={"id": str(plan_id)})


@router.post("/admin/pricing-plans/reorder", response_model=APIResponse[list[dict]])
async def admin_reorder_plans(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Bulk-update sort_order. Body: {"order": [{"id": "...", "sort_order": 1}, ...]}
    Plans not in the payload keep their existing sort_order.
    """
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    order = payload.get("order")
    if not isinstance(order, list):
        raise HTTPException(status_code=400, detail="order must be a list of {id, sort_order}")

    # Bulk-load all the plans referenced (one query, not N).
    ids: list[uuid.UUID] = []
    for entry in order:
        try:
            ids.append(uuid.UUID(str(entry.get("id"))))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="invalid id in order list")
    if not ids:
        return APIResponse(success=True, data=[])

    plans = (await db.execute(
        select(PricingPlan).where(
            PricingPlan.id.in_(ids),
            PricingPlan.tenant_id == tenant_uuid,
            PricingPlan.deleted_at.is_(None),
        )
    )).scalars().all()
    by_id = {p.id: p for p in plans}

    for entry in order:
        try:
            pid = uuid.UUID(str(entry["id"]))
            so = int(entry["sort_order"])
        except (KeyError, TypeError, ValueError):
            continue
        plan = by_id.get(pid)
        if plan is not None:
            plan.sort_order = so

    await db.flush()
    # Return the canonical ordering for the FE to sync to.
    rows = (await db.execute(
        select(PricingPlan)
        .where(PricingPlan.tenant_id == tenant_uuid, PricingPlan.deleted_at.is_(None))
        .order_by(PricingPlan.sort_order.asc(), PricingPlan.created_at.asc())
    )).scalars().all()
    logger.info("admin_reorder_pricing_plans", admin=current_user.get("sub"), n=len(order))
    return APIResponse(success=True, data=[_serialize(p) for p in rows])


# ─── Public endpoint ─────────────────────────────────────────────────────────


@router.get("/pricing-plans", response_model=APIResponse[list[dict]])
async def public_list_plans(
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Active plans only, no auth required. Powers the public pricing page."""
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    rows = (await db.execute(
        select(PricingPlan)
        .where(
            PricingPlan.tenant_id == tenant_uuid,
            PricingPlan.deleted_at.is_(None),
            PricingPlan.is_active == True,  # noqa: E712
        )
        .order_by(PricingPlan.sort_order.asc(), PricingPlan.created_at.asc())
    )).scalars().all()
    return APIResponse(success=True, data=[_serialize(p) for p in rows])
