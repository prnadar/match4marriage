"""
PayPal service — one-time Orders API (intent=CAPTURE).

Credentials are read from the admin-managed ``PaymentGatewayConfig`` row
(gateway = ``paypal``), not env vars, so keys can be rotated without a
redeploy:

    publishable_key  -> PayPal REST Client ID  (public)
    secret_key       -> PayPal REST Client Secret (write-only)
    webhook_secret   -> PayPal Webhook ID (used for signature verification)
    is_test_mode     -> True = sandbox, False = live

No PayPal SDK dependency — raw REST over ``requests`` (same approach as the
Stripe integration in subscriptions.py).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests as http_requests
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.payment_gateway_config import PaymentGatewayConfig, PaymentGatewayName

logger = get_logger(__name__)

_SANDBOX_BASE = "https://api-m.sandbox.paypal.com"
_LIVE_BASE = "https://api-m.paypal.com"
_TIMEOUT = 20


@dataclass
class PayPalConfig:
    client_id: str
    client_secret: str
    webhook_id: str | None
    is_sandbox: bool

    @property
    def base_url(self) -> str:
        return _SANDBOX_BASE if self.is_sandbox else _LIVE_BASE


class PayPalError(Exception):
    """Raised when PayPal returns an error or is misconfigured."""


async def load_paypal_config(db: AsyncSession, tenant_id) -> PayPalConfig | None:
    """
    Return the active PayPal config for a tenant, or None if PayPal is not
    set up / not active / missing credentials.
    """
    row = (await db.execute(
        select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.tenant_id == tenant_id,
            PaymentGatewayConfig.gateway == PaymentGatewayName.PAYPAL,
            PaymentGatewayConfig.deleted_at.is_(None),
        )
    )).scalar_one_or_none()

    if row is None or not row.is_active:
        return None
    if not row.publishable_key or not row.secret_key:
        return None

    return PayPalConfig(
        client_id=row.publishable_key,
        client_secret=row.secret_key,
        webhook_id=row.webhook_secret or None,
        is_sandbox=bool(row.is_test_mode),
    )


def _access_token(cfg: PayPalConfig) -> str:
    resp = http_requests.post(
        f"{cfg.base_url}/v1/oauth2/token",
        auth=(cfg.client_id, cfg.client_secret),
        data={"grant_type": "client_credentials"},
        headers={"Accept": "application/json"},
        timeout=_TIMEOUT,
    )
    if resp.status_code >= 400:
        logger.error("paypal_token_error", status=resp.status_code, body=resp.text[:500])
        raise PayPalError("Could not authenticate with PayPal")
    return resp.json()["access_token"]


def _auth_headers(cfg: PayPalConfig) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_access_token(cfg)}",
        "Content-Type": "application/json",
    }


def create_order(
    cfg: PayPalConfig,
    *,
    amount_pence: int,
    currency: str,
    plan: str,
    return_url: str,
    cancel_url: str,
    custom_id: str,
    description: str,
) -> dict[str, Any]:
    """
    Create a one-time CAPTURE order. Returns
    ``{"order_id": str, "approve_url": str}``.

    ``custom_id`` carries our own correlation data (``user_id|plan|tenant``)
    so the capture/webhook can reconcile without trusting client input.
    """
    amount_str = f"{amount_pence / 100:.2f}"
    body = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "custom_id": custom_id[:127],
                "description": description[:127],
                "amount": {"currency_code": currency, "value": amount_str},
            }
        ],
        "application_context": {
            "brand_name": "Match4Marriage",
            "shipping_preference": "NO_SHIPPING",
            "user_action": "PAY_NOW",
            "return_url": return_url,
            "cancel_url": cancel_url,
        },
    }
    resp = http_requests.post(
        f"{cfg.base_url}/v2/checkout/orders",
        headers=_auth_headers(cfg),
        json=body,
        timeout=_TIMEOUT,
    )
    if resp.status_code >= 400:
        logger.error("paypal_create_order_error", status=resp.status_code, body=resp.text[:500])
        raise PayPalError("Could not create PayPal order")

    data = resp.json()
    approve = next(
        (l["href"] for l in data.get("links", []) if l.get("rel") == "approve"),
        None,
    )
    if not approve:
        raise PayPalError("PayPal did not return an approval link")
    return {"order_id": data["id"], "approve_url": approve}


def get_order(cfg: PayPalConfig, order_id: str) -> dict[str, Any]:
    resp = http_requests.get(
        f"{cfg.base_url}/v2/checkout/orders/{order_id}",
        headers=_auth_headers(cfg),
        timeout=_TIMEOUT,
    )
    if resp.status_code >= 400:
        logger.error("paypal_get_order_error", status=resp.status_code, body=resp.text[:500])
        raise PayPalError("Could not fetch PayPal order")
    return resp.json()


def capture_order(cfg: PayPalConfig, order_id: str) -> dict[str, Any]:
    """
    Capture an approved order. Idempotent on PayPal's side: capturing an
    already-captured order returns 422 ORDER_ALREADY_CAPTURED, which we
    treat as success by re-reading the order.
    """
    resp = http_requests.post(
        f"{cfg.base_url}/v2/checkout/orders/{order_id}/capture",
        headers=_auth_headers(cfg),
        json={},
        timeout=_TIMEOUT,
    )
    if resp.status_code == 422 and "ORDER_ALREADY_CAPTURED" in resp.text:
        return get_order(cfg, order_id)
    if resp.status_code >= 400:
        logger.error("paypal_capture_error", status=resp.status_code, body=resp.text[:500])
        raise PayPalError("Could not capture PayPal payment")
    return resp.json()


def order_is_paid(order: dict[str, Any]) -> bool:
    """True when the order (from capture or get) is fully captured."""
    if order.get("status") == "COMPLETED":
        return True
    for pu in order.get("purchase_units", []):
        for cap in pu.get("payments", {}).get("captures", []):
            if cap.get("status") == "COMPLETED":
                return True
    return False


def extract_custom_id(order: dict[str, Any]) -> str | None:
    for pu in order.get("purchase_units", []):
        if pu.get("custom_id"):
            return pu["custom_id"]
        for cap in pu.get("payments", {}).get("captures", []):
            if cap.get("custom_id"):
                return cap["custom_id"]
    return None


def verify_webhook(cfg: PayPalConfig, headers: dict[str, str], raw_body: bytes) -> bool:
    """
    Verify a webhook using PayPal's verify-webhook-signature API. Requires
    the Webhook ID to be configured (stored in webhook_secret). If no
    webhook ID is set we cannot verify and must reject.
    """
    if not cfg.webhook_id:
        logger.warning("paypal_webhook_no_id_configured")
        return False

    # Header names are case-insensitive; normalise.
    h = {k.lower(): v for k, v in headers.items()}
    try:
        import json as _json
        payload = {
            "auth_algo": h.get("paypal-auth-algo"),
            "cert_url": h.get("paypal-cert-url"),
            "transmission_id": h.get("paypal-transmission-id"),
            "transmission_sig": h.get("paypal-transmission-sig"),
            "transmission_time": h.get("paypal-transmission-time"),
            "webhook_id": cfg.webhook_id,
            "webhook_event": _json.loads(raw_body or b"{}"),
        }
    except Exception:
        return False

    resp = http_requests.post(
        f"{cfg.base_url}/v1/notifications/verify-webhook-signature",
        headers=_auth_headers(cfg),
        json=payload,
        timeout=_TIMEOUT,
    )
    if resp.status_code >= 400:
        logger.error("paypal_webhook_verify_error", status=resp.status_code, body=resp.text[:300])
        return False
    return resp.json().get("verification_status") == "SUCCESS"
