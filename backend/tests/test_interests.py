"""Expressions of interest: sending, accepting (mutual), and status reads."""
import pytest
from sqlalchemy import select

from app.models.match import ChatThread, Interest, InterestStatus
from tests._admin_seed import HEADERS as H, as_member, member, tenant


@pytest.mark.asyncio
async def test_send_interest_then_status_survives_reload(client, db):
    t = await tenant(db)
    a, b = await member(db, t, first="Arun"), await member(db, t, first="Bhavna")
    as_member(a)

    r = await client.post(f"/api/v1/interests/{b.id}", headers=H)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "pending"

    # What the profile page reads after a refresh.
    s = (await client.get(f"/api/v1/interests/status?user_id={b.id}", headers=H)).json()["data"]
    assert s["sent"] == {str(b.id): "pending"}
    assert s["received"] == {}

    # Sending again is a clean 409, not a 500.
    assert (await client.post(f"/api/v1/interests/{b.id}", headers=H)).status_code == 409


@pytest.mark.asyncio
async def test_accepting_a_received_interest_makes_it_mutual(client, db):
    """Regression: the mutual path used to 500 (expired updated_at lazy-loaded
    in async), rolling back the accept — so 'Accept' never worked."""
    t = await tenant(db)
    a, b = await member(db, t, first="Arun"), await member(db, t, first="Bhavna")

    as_member(b)
    assert (await client.post(f"/api/v1/interests/{a.id}", headers=H)).status_code == 200

    as_member(a)
    r = await client.post(f"/api/v1/interests/{b.id}", headers=H)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "accepted"

    rows = (await db.execute(select(Interest))).scalars().all()
    assert {i.status for i in rows} == {InterestStatus.ACCEPTED}
    assert len((await db.execute(select(ChatThread))).scalars().all()) == 1

    s = (await client.get("/api/v1/interests/status", headers=H)).json()["data"]
    assert s["sent"][str(b.id)] == "accepted" and s["received"][str(b.id)] == "accepted"


@pytest.mark.asyncio
async def test_basic_member_at_quota_can_still_accept(client, db, monkeypatch):
    t = await tenant(db)
    a, b = await member(db, t), await member(db, t)
    import app.core.entitlements as ent
    monkeypatch.setattr(ent, "interest_limit", lambda plan: 0)  # quota already used up

    as_member(b)
    db.add(Interest(tenant_id=t.id, sender_id=b.id, receiver_id=a.id))
    await db.flush()

    as_member(a)
    assert (await client.post(f"/api/v1/interests/{b.id}", headers=H)).status_code == 200
    # …but a brand-new interest is still blocked by the quota.
    c = await member(db, t)
    assert (await client.post(f"/api/v1/interests/{c.id}", headers=H)).status_code == 403


@pytest.mark.asyncio
async def test_cannot_send_interest_to_self(client, db):
    t = await tenant(db)
    a = await member(db, t)
    as_member(a)
    assert (await client.post(f"/api/v1/interests/{a.id}", headers=H)).status_code == 400


@pytest.mark.asyncio
async def test_decline_is_saved_and_cannot_then_be_accepted_by_mistake(client, db):
    t = await tenant(db)
    a, b = await member(db, t), await member(db, t)
    as_member(a)
    await client.post(f"/api/v1/interests/{b.id}", headers=H)

    as_member(b)
    r = await client.post(f"/api/v1/interests/{a.id}/decline", headers=H)
    assert r.status_code == 200 and r.json()["data"]["status"] == "declined"
    assert (await client.post(f"/api/v1/interests/{a.id}/decline", headers=H)).status_code == 200  # idempotent
    s = (await client.get("/api/v1/interests/status", headers=H)).json()["data"]
    assert s["received"][str(a.id)] == "declined"

    as_member(a)
    s = (await client.get("/api/v1/interests/status", headers=H)).json()["data"]
    assert s["sent"][str(b.id)] == "declined"
    # Nobody else's interest can be declined on their behalf.
    assert (await client.post(f"/api/v1/interests/{b.id}/decline", headers=H)).status_code == 404
