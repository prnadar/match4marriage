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

# Canonical tier → marketing-name mapping. Matches config.py and the DB
# pricing_plans the cards are built from — the plans members actually pay
# against: silver=Basic (£100), gold=Premium (£300), platinum=Elite (£1,000).
# A prior "off by one" change shifted this to silver=Premium/gold=Elite, which
# made a gold (Premium) buyer's current plan + welcome notification read
# "Elite". "free" = no active subscription, shown as the Basic entry tier.
PLAN_DISPLAY: dict[str, str] = {
    "free": "Basic",
    "silver": "Basic",
    "gold": "Premium",
    "platinum": "Elite",
}


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


def _frontend_base() -> str:
    """Base URL PayPal returns the buyer to after they approve a payment.

    Use FRONTEND_URL only when it's the live match4marriage.com domain; otherwise
    fall back to the canonical site. A stale ``*.vercel.app`` project URL (or a
    localhost value) would 404 the buyer on return — the exact
    DEPLOYMENT_NOT_FOUND error customers were hitting after confirming payment.
    """
    fu = (settings.FRONTEND_URL or "").rstrip("/")
    host = fu.split("://", 1)[-1].split("/", 1)[0].lower()
    if host in ("www.match4marriage.com", "match4marriage.com"):
        return fu
    return "https://www.match4marriage.com"


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

    base = _frontend_base()
    return_url = f"{base}/subscription?paypal=return"
    cancel_url = f"{base}/subscription?paypal=cancel"

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
    capture call lands, PayPal still tells us via webhook. Also processes
    refunds and reversals — without this, refunded members kept their
    paid tier indefinitely.

    Tenant resolution: PayPal doesn't send X-Tenant-ID, so we PREFER the
    tenant slug embedded in our `custom_id` (`user|plan|tenant`). The
    header-derived `tenant_slug` is only a fallback for single-tenant
    deploys where the request middleware falls back to DEFAULT_TENANT_SLUG.
    """
    body = await request.body()
    try:
        event = json.loads(body or b"{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

    event_type = event.get("event_type", "")
    resource = event.get("resource", {}) or {}
    custom_id = resource.get("custom_id", "") or ""
    parts = custom_id.split("|")
    if len(parts) >= 3 and parts[2]:
        tenant_slug = parts[2]

    tenant_uuid = await _resolve_tenant(db, tenant_slug)
    if tenant_uuid is None:
        logger.warning("paypal_webhook_unknown_tenant", tenant_slug=tenant_slug, event_type=event_type)
        return {"status": "ok", "skipped": "unknown tenant"}

    cfg = await paypal_svc.load_paypal_config(db, tenant_uuid)
    if cfg is None:
        logger.warning("paypal_webhook_no_config", tenant=tenant_slug, event_type=event_type)
        return {"status": "ok", "skipped": "paypal not configured"}

    if not paypal_svc.verify_webhook(cfg, dict(request.headers), body):
        raise HTTPException(status_code=400, detail="Invalid PayPal webhook signature")

    logger.info("paypal_webhook", event_type=event_type, event_id=event.get("id"))

    # ── Refund / reversal — downgrade the member's tier ─────────────────
    if event_type in ("PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"):
        await _downgrade_on_refund(db, resource, tenant_uuid, event)
        await db.commit()
        return {"status": "ok"}

    if event_type != "PAYMENT.CAPTURE.COMPLETED":
        return {"status": "ok", "skipped": event_type}

    # Key idempotency on the ORDER id (stable across the capture API path and
    # this webhook) so a page-refresh capture and this webhook don't both
    # create a subscription.
    order_id = (
        resource.get("supplementary_data", {})
        .get("related_ids", {})
        .get("order_id", "")
    ) or resource.get("id", "")
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


async def _downgrade_on_refund(
    db: AsyncSession,
    resource: dict,
    tenant_id: uuid.UUID,
    event: dict,
) -> None:
    """Find the Subscription that matches the refunded capture and downgrade
    the owning user to the free tier. PayPal sends refund webhooks for the
    full lifetime of the order, so we identify the matching subscription via
    `custom_id` (canonical) with a fallback on `order_id`."""
    custom_id = (resource.get("custom_id") or "").split("|")
    if len(custom_id) < 2:
        logger.warning("paypal_refund_bad_custom_id", custom_id=resource.get("custom_id"))
        return
    try:
        user_uuid = uuid.UUID(custom_id[0])
    except ValueError:
        return

    # Mark every paid subscription this user has on this tenant as cancelled
    # (we don't have a REFUNDED enum value; CANCELLED has the same product
    # effect — they lose access — and the refund event_id is captured in the
    # log line below for audit).
    await db.execute(
        update(Subscription)
        .where(
            Subscription.tenant_id == tenant_id,
            Subscription.user_id == user_uuid,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.deleted_at.is_(None),
        )
        .values(status=SubscriptionStatus.CANCELLED)
    )
    await db.execute(
        update(User)
        .where(User.id == user_uuid)
        .values(subscription_tier=SubscriptionTier.FREE)
    )
    logger.info(
        "paypal_refund_downgrade",
        user_id=str(user_uuid),
        event_id=event.get("id"),
        capture_id=resource.get("id"),
    )


@router.get("/subscriptions/limits", response_model=APIResponse[FeatureLimits])
async def get_feature_limits(
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_slug: str = Depends(get_current_tenant_slug),
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

    from app.core.entitlements import (
        can_message,
        can_use_advanced_filters,
        can_view_photos,
        can_view_premium_photos,
        interest_limit,
    )

    # interests_remaining is the actual remaining count, not the plan cap.
    # The prior implementation returned the cap (10) for everyone on free,
    # so the client could never short-circuit when the user had exhausted
    # their quota — every send hit the backend and surfaced a 403 instead.
    interests_remaining_val: int
    cap = interest_limit(plan)
    if cap is None:
        interests_remaining_val = -1  # unlimited
    else:
        from datetime import timezone as _tz
        from sqlalchemy import func as _func
        from app.models.match import Interest
        try:
            now = datetime.now(_tz.utc)
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            sent = (await db.execute(
                select(_func.count())
                .select_from(Interest)
                .where(
                    Interest.sender_id == user_uuid,
                    Interest.deleted_at.is_(None),
                    Interest.created_at >= period_start,
                )
            )).scalar_one()
            interests_remaining_val = max(0, cap - int(sent))
        except Exception:
            interests_remaining_val = cap  # fail open with cap if count blows up

    return APIResponse(
        success=True,
        data=FeatureLimits(
            plan=plan,
            interests_remaining=interests_remaining_val,
            contacts_remaining=limits["contacts"],
            video_calls_remaining=limits["video_calls"],
            can_video_call=plan != "free",
            can_view_contact=plan in ("silver", "gold", "platinum"),
            can_incognito_browse=plan in ("gold", "platinum"),
            can_send_voice_note=True,
            can_message=can_message(plan),
            can_view_photos=can_view_photos(plan),
            can_view_premium_photos=can_view_premium_photos(plan),
            can_use_advanced_filters=can_use_advanced_filters(plan),
        ),
    )
