"""
Admin: payment gateway credentials.

Secrets are write-only. GET masks them as `secret_tail` (last 4 chars) so
admins can verify what's set without exposing the value. Setting a field to
null clears it; omitting a field leaves it untouched (partial update).
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
from app.models.payment_gateway_config import PaymentGatewayConfig, PaymentGatewayName
from app.schemas.common import APIResponse

router = APIRouter(tags=["admin-payment-gateway"])
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


def _mask(secret: str | None) -> str | None:
    """Last 4 chars; None if not set; full mask if shorter than 4."""
    if not secret:
        return None
    if len(secret) <= 4:
        return "•" * len(secret)
    return f"…{secret[-4:]}"


def _serialize(c: PaymentGatewayConfig) -> dict[str, Any]:
    """Public-shape view. Never returns secret values."""
    return {
        "id": str(c.id),
        "gateway": c.gateway.value,
        "publishable_key": c.publishable_key,  # public by definition
        "secret_configured": bool(c.secret_key),
        "secret_tail": _mask(c.secret_key),
        "webhook_configured": bool(c.webhook_secret),
        "webhook_tail": _mask(c.webhook_secret),
        "is_test_mode": bool(c.is_test_mode),
        "is_active": bool(c.is_active),
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/admin/payment-gateways", response_model=APIResponse[list[dict]])
async def list_gateways(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """All gateways the tenant has touched. Returns one row per gateway."""
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    rows = (await db.execute(
        select(PaymentGatewayConfig)
        .where(
            PaymentGatewayConfig.tenant_id == tenant_uuid,
            PaymentGatewayConfig.deleted_at.is_(None),
        )
        .order_by(PaymentGatewayConfig.gateway.asc())
    )).scalars().all()
    return APIResponse(success=True, data=[_serialize(r) for r in rows])


@router.put("/admin/payment-gateways/{gateway}", response_model=APIResponse[dict])
async def upsert_gateway(
    gateway: str,
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Upsert by gateway name. Body fields:
      - publishable_key: string | null
      - secret_key:      string (writes), null (clears), omit (untouched)
      - webhook_secret:  string (writes), null (clears), omit (untouched)
      - is_test_mode:    bool
      - is_active:       bool
    """
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    try:
        gw = PaymentGatewayName(gateway.strip().lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"gateway must be one of {[g.value for g in PaymentGatewayName]}")

    row = (await db.execute(
        select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.tenant_id == tenant_uuid,
            PaymentGatewayConfig.gateway == gw,
            PaymentGatewayConfig.deleted_at.is_(None),
        )
    )).scalar_one_or_none()

    if row is None:
        row = PaymentGatewayConfig(tenant_id=tenant_uuid, gateway=gw)
        db.add(row)

    if "publishable_key" in payload:
        v = payload.get("publishable_key")
        row.publishable_key = (str(v).strip()[:255] or None) if v else None

    if "secret_key" in payload:
        v = payload.get("secret_key")
        # Explicit `null` clears the secret. Anything else writes it.
        if v is None:
            row.secret_key = None
        else:
            row.secret_key = str(v)[:512]

    if "webhook_secret" in payload:
        v = payload.get("webhook_secret")
        if v is None:
            row.webhook_secret = None
        else:
            row.webhook_secret = str(v)[:512]

    if "is_test_mode" in payload:
        row.is_test_mode = bool(payload.get("is_test_mode"))

    if "is_active" in payload:
        row.is_active = bool(payload.get("is_active"))

    await db.flush()
    await db.refresh(row)
    logger.info("upsert_payment_gateway", gateway=gw.value, by=current_user.get("sub"), is_active=row.is_active)
    return APIResponse(success=True, data=_serialize(row))


@router.delete("/admin/payment-gateways/{gateway}", response_model=APIResponse[dict])
async def delete_gateway(
    gateway: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Soft-delete (sets deleted_at) and clears secrets to make leakage harmless."""
    from datetime import datetime, timezone
    _require_admin(current_user)
    tenant_uuid = await _tenant_uuid(db, tenant_slug)
    try:
        gw = PaymentGatewayName(gateway.strip().lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid gateway")
    row = (await db.execute(
        select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.tenant_id == tenant_uuid,
            PaymentGatewayConfig.gateway == gw,
            PaymentGatewayConfig.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Gateway config not found")
    row.deleted_at = datetime.now(timezone.utc)
    row.secret_key = None
    row.webhook_secret = None
    row.is_active = False
    await db.flush()
    logger.info("delete_payment_gateway", gateway=gw.value, by=current_user.get("sub"))
    return APIResponse(success=True, data={"gateway": gw.value})
