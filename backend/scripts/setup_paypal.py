#!/usr/bin/env python3
"""
Configure + verify the PayPal payment gateway in one command.

This removes the manual "Admin → Settings → Payment Gateways" clicking and,
critically, *verifies* the credentials against PayPal before you trust them
in production — so you find a wrong key now, not when a member tries to pay.

Usage (sandbox — the default):

    python backend/scripts/setup_paypal.py \
        --client-id "AY...sandbox..." \
        --secret "EL...sandbox..." \
        --webhook-id "5GP..."          # optional but needed for webhooks

Go live (after sandbox works):

    python backend/scripts/setup_paypal.py --live \
        --client-id "AY...live..." --secret "EL...live..." --webhook-id "8Xh..."

Just re-check existing stored credentials without changing anything:

    python backend/scripts/setup_paypal.py --verify-only

What it does:
  1. Resolves the tenant (default: match4marriage).
  2. Upserts the paypal row in payment_gateway_configs (is_active=true,
     is_test_mode = not --live). Secrets are written as-is (same storage
     the admin UI uses).
  3. Calls PayPal's OAuth endpoint with the credentials. If that succeeds
     the keys are valid for the chosen environment.
  4. With --create-test-order, also creates a real (sandbox) £1 order and
     prints the approval URL so you can click through end-to-end.

DATABASE_URL is read from backend/.env.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

_SANDBOX = "https://api-m.sandbox.paypal.com"
_LIVE = "https://api-m.paypal.com"


def _check_paypal(client_id: str, secret: str, base: str) -> tuple[bool, str]:
    """Returns (ok, message). Validates creds via the OAuth token call."""
    import requests

    try:
        r = requests.post(
            f"{base}/v1/oauth2/token",
            auth=(client_id, secret),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json"},
            timeout=20,
        )
    except Exception as e:  # noqa: BLE001
        return False, f"could not reach PayPal: {e}"
    if r.status_code >= 400:
        return False, f"PayPal rejected the credentials (HTTP {r.status_code}): {r.text[:200]}"
    return True, "credentials valid"


def _make_test_order(client_id: str, secret: str, base: str) -> str | None:
    import requests

    tok = requests.post(
        f"{base}/v1/oauth2/token",
        auth=(client_id, secret),
        data={"grant_type": "client_credentials"},
        timeout=20,
    ).json()["access_token"]
    r = requests.post(
        f"{base}/v2/checkout/orders",
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
        json={
            "intent": "CAPTURE",
            "purchase_units": [{
                "custom_id": "setup-script-test",
                "description": "Match4Marriage PayPal setup test",
                "amount": {"currency_code": "GBP", "value": "1.00"},
            }],
            "application_context": {"shipping_preference": "NO_SHIPPING", "user_action": "PAY_NOW"},
        },
        timeout=20,
    )
    if r.status_code >= 400:
        print(f"  ! test order failed (HTTP {r.status_code}): {r.text[:200]}")
        return None
    data = r.json()
    return next((l["href"] for l in data.get("links", []) if l.get("rel") == "approve"), None)


async def main() -> int:
    ap = argparse.ArgumentParser(description="Configure + verify PayPal gateway")
    ap.add_argument("--client-id")
    ap.add_argument("--secret")
    ap.add_argument("--webhook-id", default=None, help="PayPal Webhook ID (for /webhook/paypal verification)")
    ap.add_argument("--tenant", default=os.getenv("DEFAULT_TENANT_SLUG", "match4marriage"))
    ap.add_argument("--live", action="store_true", help="Use live PayPal (default: sandbox)")
    ap.add_argument("--verify-only", action="store_true", help="Re-check stored creds, write nothing")
    ap.add_argument("--create-test-order", action="store_true", help="Also create a sandbox test order + print approval URL")
    args = ap.parse_args()

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL is not set (looked in backend/.env).")
        return 1
    safe_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1) \
        if db_url.startswith("postgresql://") else db_url

    base = _LIVE if args.live else _SANDBOX
    env_name = "LIVE" if args.live else "SANDBOX"
    engine = create_async_engine(safe_url, echo=False)

    try:
        async with engine.connect() as conn:
            row = (await conn.execute(
                text("SELECT id FROM tenants WHERE slug = :s LIMIT 1"),
                {"s": args.tenant},
            )).first()
            if not row:
                print(f"ERROR: tenant '{args.tenant}' not found.")
                return 1
            tenant_id = row[0]

            if args.verify_only:
                cfg = (await conn.execute(text(
                    "SELECT publishable_key, secret_key, is_test_mode "
                    "FROM payment_gateway_configs "
                    "WHERE tenant_id = :t AND gateway = CAST('paypal' AS paymentgatewayname) "
                    "AND deleted_at IS NULL"
                ), {"t": tenant_id})).first()
                if not cfg or not cfg[0] or not cfg[1]:
                    print("No stored PayPal credentials to verify.")
                    return 1
                vbase = _SANDBOX if cfg[2] else _LIVE
                ok, msg = _check_paypal(cfg[0], cfg[1], vbase)
                print(f"[{'OK' if ok else 'FAIL'}] stored {'SANDBOX' if cfg[2] else 'LIVE'} creds: {msg}")
                return 0 if ok else 1

        if not args.client_id or not args.secret:
            print("ERROR: --client-id and --secret are required (or use --verify-only).")
            return 1

        # Verify BEFORE writing — never store creds we know are bad.
        ok, msg = _check_paypal(args.client_id, args.secret, base)
        print(f"[{'OK' if ok else 'FAIL'}] {env_name} credential check: {msg}")
        if not ok:
            print("Aborting — nothing was written.")
            return 1

        async with engine.begin() as conn:
            await conn.execute(text("""
                INSERT INTO payment_gateway_configs
                    (id, tenant_id, gateway, publishable_key, secret_key,
                     webhook_secret, is_test_mode, is_active)
                VALUES
                    (:id, :tenant_id, CAST('paypal' AS paymentgatewayname),
                     :pk, :sk, :wh, :test, true)
                ON CONFLICT (tenant_id, gateway) DO UPDATE SET
                    publishable_key = EXCLUDED.publishable_key,
                    secret_key      = EXCLUDED.secret_key,
                    webhook_secret  = COALESCE(EXCLUDED.webhook_secret, payment_gateway_configs.webhook_secret),
                    is_test_mode    = EXCLUDED.is_test_mode,
                    is_active       = true,
                    deleted_at      = NULL,
                    updated_at      = now()
            """), {
                "id": uuid.uuid4(),
                "tenant_id": tenant_id,
                "pk": args.client_id,
                "sk": args.secret,
                "wh": args.webhook_id,
                "test": (not args.live),
            })

        print(f"[OK] PayPal configured for tenant '{args.tenant}' ({env_name}, active).")
        if not args.webhook_id:
            print("  ! No --webhook-id given. Capture-on-return still works, but the")
            print("    /webhook/paypal backstop will reject events until you set it.")

        if args.create_test_order:
            url = _make_test_order(args.client_id, args.secret, base)
            if url:
                print("\nTest order created. Open this to approve a sandbox payment:")
                print(f"  {url}")

        print("\nNext: open /subscription, click Pay with PayPal, complete a")
        print("sandbox payment, and confirm the plan activates.")
        return 0
    finally:
        await engine.dispose()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
