"""Time-limited promo pricing (e.g. Premium 50% off until New Year)."""
from datetime import datetime, timedelta

import pytest

from app.models.pricing_plan import PricingPeriod, PricingPlan, effective_pricing
from tests._admin_seed import HEADERS as H, as_admin, tenant


def _plan(**kw) -> PricingPlan:
    base = dict(key="premium", name="Premium", tier="gold", price_paise=15000,
                original_price_paise=30000, currency="GBP", period=PricingPeriod.HALF_YEARLY)
    base.update(kw)
    return PricingPlan(**base)


def test_offer_applies_until_end_then_reverts():
    ends = datetime(2027, 1, 1)
    p = _plan(offer_ends_at=ends)
    assert effective_pricing(p, now=datetime(2026, 12, 31, 23, 59)) == (15000, 30000, ends)
    assert effective_pricing(p, now=ends) == (30000, None, None)


def test_no_end_date_and_no_discount_cases():
    assert effective_pricing(_plan(offer_ends_at=None))[:2] == (15000, 30000)
    # "was" equal to the price (the old Premium row) is not a promo.
    assert effective_pricing(_plan(price_paise=30000, offer_ends_at=None)) == (30000, None, None)


@pytest.mark.asyncio
async def test_public_plans_show_live_offer_and_hide_expired(client, db):
    t = await tenant(db)
    db.add_all([
        _plan(tenant_id=t.id, offer_ends_at=datetime.utcnow() + timedelta(days=10)),
        _plan(tenant_id=t.id, key="elite", name="Elite", tier="platinum", price_paise=50000,
              original_price_paise=100000, offer_ends_at=datetime.utcnow() - timedelta(minutes=1)),
    ])
    await db.flush()

    plans = {p["key"]: p for p in (await client.get("/api/v1/pricing-plans", headers=H)).json()["data"]}
    assert plans["premium"]["price_paise"] == 15000
    assert plans["premium"]["original_price_paise"] == 30000
    assert plans["premium"]["offer_ends_at"]
    assert plans["elite"]["price_paise"] == 100000           # offer over → regular price
    assert plans["elite"]["original_price_paise"] is None


@pytest.mark.asyncio
async def test_admin_can_set_and_clear_offer_end(client, db):
    t = await tenant(db)
    plan = _plan(tenant_id=t.id)
    db.add(plan)
    await db.flush()
    as_admin()

    r = await client.put(f"/api/v1/admin/pricing-plans/{plan.id}", json={"offer_ends_at": "2027-01-01"}, headers=H)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["offer_ends_at"].startswith("2027-01-01T00:00:00")

    r = await client.put(f"/api/v1/admin/pricing-plans/{plan.id}", json={"offer_ends_at": None}, headers=H)
    assert r.json()["data"]["offer_ends_at"] is None

    r = await client.put(f"/api/v1/admin/pricing-plans/{plan.id}", json={"offer_ends_at": "soon"}, headers=H)
    assert r.status_code == 400
