"""
Subscription + Payments router — PayPal only.

POST /api/v1/subscriptions/create-checkout   — create a PayPal order
POST /api/v1/subscriptions/paypal/capture    — capture an approved PayPal order
POST /api/v1/subscriptions/webhook/paypal    — PayPal webhook (resilient backstop)
GET  /api/v1/subscriptions/limits            — current user's plan limits

Stripe and Razorpay were removed: PayPal is the only gateway.
"""
import json
import uuid
from datetime import datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user
from app.core.tenancy import get_current_tenant_slug
from app.models.notification import Notification
from app.models.subscription import PaymentGateway, Subscription, SubscriptionStatus
from app.models.user import SubscriptionTier, User
from app.services import paypal as paypal_svc
from app.schemas.common import APIResponse
from app.schemas.subscription import FeatureLimits

router = APIRouter(tags=["subscriptions"])
settings = get_settings()
logger = get_logger(__name__)

PLAN_FEATURE_MAP = {
    "free": {"interests": 10, "contacts": 0, "video_calls": 0},
    "silver": {"interests": -1, "contacts": 5, "video_calls": 10},
    "gold": {"interests": -1, "contacts": -1, "video_calls": -1},
    "platinum": {"interests": -1, "contacts": -1, "video_calls": -1},
}

PLAN_TIER_MAP: dict[str, SubscriptionTier] = {
    "silver": SubscriptionTier.SILVER,
    "gold": SubscriptionTier.GOLD,
    "platinum": SubscriptionTier.PLATINUM,
    "free": SubscriptionTier.FREE,
}

# Paid plans are sold as fixed 6-month terms (see /pricing).
PLAN_TERM_DAYS: dict[str, int] = {"silver": 180, "gold": 180, "platinum": 180}

# Fallback prices (pence) used only if no active DB pricing plan exists.
PLAN_PRICE_GBP_PENCE: dict[str, int] = {
    "silver": settings.SILVER_PRICE_GBP,
    "gold": settings.GOLD_PRICE_GBP,
    "platinum": settings.PLATINUM_PRICE_GBP,
}

PLAN_DISPLAY: dict[str, str] = {"silver": "Basic", "gold": "Premium", "platinum": "Elite"}


class CheckoutRequest(BaseModel):
    plan: Literal["silver", "gold", "platinum"]
    # Kept for frontend compatibility; PayPal is the only gateway.
    currency: Literal["GBP", "INR"] | None = None
    gateway: Literal["paypal"] | None = None


class PayPalCaptureRequest(BaseModel):
    order_id: str


@router.post("/subscriptions/create-checkout", response_model=APIResponse[dict])
async def create_checkout(
    payload: CheckoutRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Create a PayPal one-time order for the chosen plan."""
    return await _checkout_paypal(payload, current_user, db, tenant_slug)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _resolve_tenant(db: AsyncSession, tenant_slug: str):
    from app.routers.profile import _resolve_tenant_uuid
    return await _resolve_tenant_uuid(db, tenant_slug)


async def _activate_subscription(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    user_uuid: uuid.UUID,
    plan: str,
    gateway: PaymentGateway,
    gateway_ref: str,
    amount_pence: int,
    currency: str,
    raw: dict,
    gateway_label: str,
) -> bool:
    """
    Idempotently activate a subscription. Returns True if newly activated,
    False if this gateway_ref was already processed (duplicate webhook /
    double capture / page refresh).
    """
    plan = plan.lower()
    tier = PLAN_TIER_MAP.get(plan)
    if not tier:
        logger.warning("activate_invalid_plan", plan=plan)
        return False

    existing = (await db.execute(
        select(Subscription).where(
            Subscription.user_id == user_uuid,
            Subscription.gateway == gateway,
            Subscription.gateway_subscription_id == gateway_ref,
        )
    )).scalar_one_or_none()
    if existing is not None:
        return False

    await db.execute(
        update(User).where(User.id == user_uuid).values(subscription_tier=tier)
    )

    # subscriptions.current_period_* are TIMESTAMP WITHOUT TIME ZONE, so use
    # naive UTC datetimes (asyncpg rejects tz-aware values for these columns).
    now = datetime.utcnow()
    period_end = now + timedelta(days=PLAN_TERM_DAYS.get(plan, 180))
    feat = PLAN_FEATURE_MAP.get(plan, {})

    db.add(Subscription(
        tenant_id=tenant_id,
        user_id=user_uuid,
        plan=plan,
        status=SubscriptionStatus.ACTIVE,
        gateway=gateway,
        gateway_subscription_id=gateway_ref,
        amount_paise=amount_pence,
        currency=currency,
        current_period_start=now,
        current_period_end=period_end,
        monthly_interests=feat.get("interests", 10),
        monthly_contacts=feat.get("contacts", 0),
        monthly_video_calls=feat.get("video_calls", 0),
        raw_webhook_data=raw,
    ))

    plan_display = PLAN_DISPLAY.get(plan, plan.title())
    db.add(Notification(
        tenant_id=tenant_id,
        user_id=user_uuid,
        type="subscription_activated",
        title=f"Welcome to {plan_display}",
        body=(
            f"Your {plan_display} plan is now active. "
            "Enjoy hand-picked introductions and premium features."
        ),
        action_url="/subscription",
        metadata={"plan": plan, "gateway": gateway_label, "ref": gateway_ref},
    ))
    return True


async def _checkout_paypal(
    payload: CheckoutRequest,
    current_user: dict,
    db: AsyncSession,
    tenant_slug: str,
) -> APIResponse:
    tenant_uuid = await _resolve_tenant(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    cfg = await paypal_svc.load_paypal_config(db, tenant_uuid)
    if cfg is None:
        raise HTTPException(status_code=503, detail="PayPal is not configured")

    plan = payload.plan

    # Price from the active DB pricing plan so the amount charged always
    # equals the amount the member saw. Fall back to the settings map.
    from app.models.pricing_plan import PricingPlan
    plan_row = (await db.execute(
        select(PricingPlan).where(
            PricingPlan.tenant_id == tenant_uuid,
            PricingPlan.tier == plan,
            PricingPlan.is_active == True,  # noqa: E712
            PricingPlan.deleted_at.is_(None),
        ).order_by(PricingPlan.sort_order.asc())
    )).scalars().first()

    if plan_row is not None:
        amount_pence = int(plan_row.price_paise)
        currency = (plan_row.currency or "GBP").upper()
    else:
        amount_pence = PLAN_PRICE_GBP_PENCE.get(plan, 0)
        currency = "GBP"

    if amount_pence <= 0:
        raise HTTPException(
            status_code=400,
            detail="This plan has no payable amount. Free plans don't require PayPal.",
        )

    user_id = current_user.get("sub") or current_user.get("user_id", "")
    custom_id = f"{user_id}|{plan}|{tenant_slug}"
    plan_display = PLAN_DISPLAY.get(plan, plan.title())

    return_url = f"{settings.FRONTEND_URL}/subscription?paypal=return"
    cancel_url = f"{settings.FRONTEND_URL}/subscription?paypal=cancel"

    try:
        order = paypal_svc.create_order(
            cfg,
            amount_pence=amount_pence,
            currency=currency,
            plan=plan,
            return_url=return_url,
            cancel_url=cancel_url,
            custom_id=custom_id,
            description=f"Match4Marriage {plan_display} (6 months)",
        )
    except paypal_svc.PayPalError as e:
        raise HTTPException(status_code=502, detail=str(e))

    logger.info("paypal_order_created", order_id=order["order_id"], plan=plan, user_id=user_id)
    return APIResponse(
        success=True,
        data={
            "gateway": "paypal",
            "order_id": order["order_id"],
            "checkout_url": order["approve_url"],
        },
    )


@router.post("/subscriptions/paypal/capture", response_model=APIResponse[dict])
async def paypal_capture(
    payload: PayPalCaptureRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Called by the frontend when PayPal redirects the buyer back. Captures
    the approved order, validates it belongs to the authenticated user,
    then activates the subscription. Safe to call more than once.
    """
    tenant_uuid = await _resolve_tenant(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    cfg = await paypal_svc.load_paypal_config(db, tenant_uuid)
    if cfg is None:
        raise HTTPException(status_code=503, detail="PayPal is not configured")

    try:
        order = paypal_svc.capture_order(cfg, payload.order_id)
    except paypal_svc.PayPalError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not paypal_svc.order_is_paid(order):
        return APIResponse(success=False, message="Payment not completed", data={"status": order.get("status")})

    custom_id = paypal_svc.extract_custom_id(order) or ""
    parts = custom_id.split("|")
    if len(parts) < 2:
        logger.warning("paypal_capture_bad_custom_id", custom_id=custom_id)
        raise HTTPException(status_code=400, detail="Order is missing correlation data")
    order_user_id, plan = parts[0], parts[1]

    auth_user_id = str(current_user.get("sub") or current_user.get("user_id", ""))
    if order_user_id != auth_user_id:
        logger.warning("paypal_capture_user_mismatch", order_user=order_user_id, auth_user=auth_user_id)
        raise HTTPException(status_code=403, detail="This payment does not belong to you")

    try:
        user_uuid = uuid.UUID(order_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user reference on order")

    cap_amt = paypal_svc.captured_amount_minor(order)
    amount_pence, currency = cap_amt if cap_amt else (PLAN_PRICE_GBP_PENCE.get(plan.lower(), 0), "GBP")

    newly = await _activate_subscription(
        db,
        tenant_id=tenant_uuid,
        user_uuid=user_uuid,
        plan=plan,
        gateway=PaymentGateway.PAYPAL,
        gateway_ref=order.get("id", payload.order_id),
        amount_pence=amount_pence,
        currency=currency,
        raw=order,
        gateway_label="paypal",
    )
    await db.commit()
    logger.info("paypal_subscription_activated", user_id=order_user_id, plan=plan, newly=newly)
    return APIResponse(success=True, data={"plan": plan, "activated": newly})


@router.post("/subscriptions/webhook/paypal", status_code=200)
async def paypal_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Resilient backstop: if the buyer closes the tab before the frontend
    capture call lands, PayPal still tells us via webhook. Signature is
    verified through PayPal's verify-webhook-signature API.
    """
    tenant_uuid = await _resolve_tenant(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    cfg = await paypal_svc.load_paypal_config(db, tenant_uuid)
    if cfg is None:
        raise HTTPException(status_code=503, detail="PayPal is not configured")

    body = await request.body()
    if not paypal_svc.verify_webhook(cfg, dict(request.headers), body):
        raise HTTPException(status_code=400, detail="Invalid PayPal webhook signature")

    event = json.loads(body or b"{}")
    event_type = event.get("event_type", "")
    logger.info("paypal_webhook", event_type=event_type, event_id=event.get("id"))

    if event_type != "PAYMENT.CAPTURE.COMPLETED":
        return {"status": "ok", "skipped": event_type}

    resource = event.get("resource", {})
    custom_id = resource.get("custom_id", "")
    # Key idempotency on the ORDER id (stable across the capture API path and
    # this webhook) so a page-refresh capture and this webhook don't both
    # create a subscription.
    order_id = (
        resource.get("supplementary_data", {})
        .get("related_ids", {})
        .get("order_id", "")
    ) or resource.get("id", "")
    parts = custom_id.split("|")
    if len(parts) < 2 or not order_id:
        logger.warning("paypal_webhook_bad_custom_id", custom_id=custom_id)
        return {"status": "ok", "skipped": "missing correlation"}

    try:
        user_uuid = uuid.UUID(parts[0])
    except ValueError:
        return {"status": "ok", "skipped": "invalid user"}
    plan = parts[1]

    cap_amt = paypal_svc.captured_amount_minor(resource)
    amount_pence, currency = cap_amt if cap_amt else (PLAN_PRICE_GBP_PENCE.get(plan.lower(), 0), "GBP")

    await _activate_subscription(
        db,
        tenant_id=tenant_uuid,
        user_uuid=user_uuid,
        plan=plan,
        gateway=PaymentGateway.PAYPAL,
        gateway_ref=order_id,
        amount_pence=amount_pence,
        currency=currency,
        raw=event,
        gateway_label="paypal",
    )
    await db.commit()
    logger.info("paypal_webhook_activated", user_id=parts[0], plan=plan, order_id=order_id)
    return {"status": "ok"}


@router.get("/subscriptions/limits", response_model=APIResponse[FeatureLimits])
async def get_feature_limits(
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Returns the current user's plan limits based on active subscription."""
    user_id_str = current_user.get("sub", "")
    plan = "free"

    try:
        user_uuid = uuid.UUID(user_id_str)
        result = await db.execute(
            select(User.subscription_tier).where(User.id == user_uuid)
        )
        row = result.scalar_one_or_none()
        if row:
            plan = row.value
    except (ValueError, AttributeError):
        pass  # demo mode or invalid UUID — default to free

    limits = PLAN_FEATURE_MAP.get(plan, PLAN_FEATURE_MAP["free"])

    return APIResponse(
        success=True,
        data=FeatureLimits(
            plan=plan,
            interests_remaining=limits["interests"],
            contacts_remaining=limits["contacts"],
            video_calls_remaining=limits["video_calls"],
            can_video_call=plan != "free",
            can_view_contact=plan in ("silver", "gold", "platinum"),
            can_incognito_browse=plan in ("gold", "platinum"),
            can_send_voice_note=True,
        ),
    )
