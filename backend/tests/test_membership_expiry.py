"""Paid memberships end when their term does."""
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.entitlements import get_user_plan
from app.models.notification import Notification
from app.models.subscription import PaymentGateway, Subscription, SubscriptionStatus
from app.models.user import SubscriptionTier
from app.services.membership_expiry import expire_lapsed
from tests._admin_seed import HEADERS as H, as_member, member, tenant


async def _paid(db, t, *, ends: datetime | None, tier=SubscriptionTier.GOLD, plan="gold"):
    u = await member(db, t)
    u.subscription_tier = tier
    db.add(Subscription(
        tenant_id=t.id, user_id=u.id, plan=plan, status=SubscriptionStatus.ACTIVE,
        gateway=PaymentGateway.PAYPAL, gateway_subscription_id=f"ref-{u.id}",
        amount_paise=30000, currency="GBP",
        current_period_start=datetime.utcnow() - timedelta(days=180), current_period_end=ends,
        raw_webhook_data={},
    ))
    await db.flush()
    return u


@pytest.mark.asyncio
async def test_lapsed_member_is_downgraded_on_next_use(db):
    t = await tenant(db)
    u = await _paid(db, t, ends=datetime.utcnow() - timedelta(hours=1))
    assert await get_user_plan(db, u.id) == "free"
    await db.refresh(u)
    assert u.subscription_tier == SubscriptionTier.FREE
    sub = (await db.execute(select(Subscription).where(Subscription.user_id == u.id))).scalar_one()
    assert sub.status == SubscriptionStatus.EXPIRED
    assert sub.raw_webhook_data["admin_events"][-1]["type"] == "term_ended"
    n = (await db.execute(select(Notification).where(Notification.user_id == u.id))).scalar_one()
    assert "Premium membership has ended" in n.title


@pytest.mark.asyncio
async def test_member_within_term_keeps_access(db):
    t = await tenant(db)
    live = await _paid(db, t, ends=datetime.utcnow() + timedelta(days=13))
    assert await get_user_plan(db, live.id) == "gold"
    assert await expire_lapsed(db) == 0


@pytest.mark.asyncio
async def test_renewed_member_with_one_live_term_keeps_access(db):
    t = await tenant(db)
    u = await _paid(db, t, ends=datetime.utcnow() - timedelta(days=1))
    db.add(Subscription(
        tenant_id=t.id, user_id=u.id, plan="gold", status=SubscriptionStatus.ACTIVE,
        gateway=PaymentGateway.PAYPAL, gateway_subscription_id="renewal",
        amount_paise=30000, currency="GBP", current_period_start=datetime.utcnow(),
        current_period_end=datetime.utcnow() + timedelta(days=180), raw_webhook_data={},
    ))
    await db.flush()
    assert await get_user_plan(db, u.id) == "gold"


@pytest.mark.asyncio
async def test_paid_tier_without_any_subscription_row_is_left_alone(db):
    t = await tenant(db)
    u = await member(db, t)
    u.subscription_tier = SubscriptionTier.PLATINUM
    await db.flush()
    assert await expire_lapsed(db) == 0
    assert await get_user_plan(db, u.id) == "platinum"


@pytest.mark.asyncio
async def test_limits_endpoint_reflects_expiry(client, db):
    t = await tenant(db)
    u = await _paid(db, t, ends=datetime.utcnow() - timedelta(minutes=5))
    as_member(u)
    r = await client.get("/api/v1/subscriptions/limits", headers=H)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["interests_remaining"] != -1  # back to the Basic quota


@pytest.mark.asyncio
async def test_cron_sweeps_everyone_and_honours_secret(client, db, monkeypatch):
    t = await tenant(db)
    await _paid(db, t, ends=datetime.utcnow() - timedelta(days=2))
    await _paid(db, t, ends=datetime.utcnow() - timedelta(days=3), tier=SubscriptionTier.PLATINUM, plan="platinum")

    monkeypatch.setenv("CRON_SECRET", "s3cret")
    assert (await client.get("/api/v1/internal/cron/expire-memberships")).status_code == 401
    r = await client.get("/api/v1/internal/cron/expire-memberships", headers={"Authorization": "Bearer s3cret"})
    assert r.status_code == 200, r.text
    assert r.json()["expired"] == 2

    monkeypatch.delenv("CRON_SECRET")
    r = await client.get("/api/v1/internal/cron/expire-memberships")
    assert r.status_code == 200 and r.json()["expired"] == 0  # idempotent


@pytest.mark.asyncio
async def test_early_same_plan_renewal_keeps_remaining_days(db):
    from app.routers.subscriptions import _activate_subscription
    t = await tenant(db)
    ends = datetime.utcnow() + timedelta(days=13)
    u = await _paid(db, t, ends=ends)
    ok = await _activate_subscription(
        db, tenant_id=t.id, user_uuid=u.id, plan="gold", gateway=PaymentGateway.PAYPAL,
        gateway_ref="renew-1", amount_pence=15000, currency="GBP", raw={}, gateway_label="PayPal",
    )
    assert ok
    await db.flush()
    new = (await db.execute(select(Subscription).where(Subscription.gateway_subscription_id == "renew-1"))).scalar_one()
    assert abs((new.current_period_end - (ends + timedelta(days=180))).total_seconds()) < 5
    n = (await db.execute(select(Notification).where(Notification.user_id == u.id))).scalar_one()
    assert n.extra_data["ref"] == "renew-1"  # metadata now actually stored
