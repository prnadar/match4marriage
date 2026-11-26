"""Member messaging over REST (works on serverless — no WebSockets needed)."""
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.rate_limit import limiter
from app.models.match import ChatThread, Message
from app.models.notification import Notification
from app.models.subscription import PaymentGateway, Subscription, SubscriptionStatus
from app.models.user import SubscriptionTier
from tests._admin_seed import HEADERS as H, as_member, member, tenant


@pytest.fixture(autouse=True)
def _mail(monkeypatch):
    sent = []

    async def fake(email, name, **kw):
        sent.append({"to": email, **kw})
        return True
    import app.services.email as email_svc
    monkeypatch.setattr(email_svc, "send_member_activity_email", fake)
    limiter.reset()
    yield sent
    limiter.reset()


async def _premium(db, t, first):
    u = await member(db, t, first=first)
    u.subscription_tier = SubscriptionTier.GOLD
    db.add(Subscription(
        tenant_id=t.id, user_id=u.id, plan="gold", status=SubscriptionStatus.ACTIVE,
        gateway=PaymentGateway.PAYPAL, gateway_subscription_id=f"r-{u.id}", amount_paise=30000,
        currency="GBP", current_period_start=datetime.utcnow(),
        current_period_end=datetime.utcnow() + timedelta(days=90), raw_webhook_data={},
    ))
    await db.flush()
    return u


async def _matched(client, db, t, a_first="Arun", b_first="Bhavna"):
    a, b = await _premium(db, t, a_first), await _premium(db, t, b_first)
    as_member(b)
    await client.post(f"/api/v1/interests/{a.id}", headers=H)
    as_member(a)
    r = await client.post(f"/api/v1/interests/{b.id}", headers=H)
    assert r.json()["data"]["status"] == "accepted"
    thread = (await db.execute(select(ChatThread))).scalar_one()
    return a, b, thread


@pytest.mark.asyncio
async def test_full_conversation_flow(client, db, _mail):
    t = await tenant(db)
    a, b, thread = await _matched(client, db, t)

    # Conversation list shows WHO it is with (was always "Member").
    as_member(a)
    lst = (await client.get("/api/v1/chats", headers=H)).json()["data"]
    assert len(lst) == 1 and lst[0]["other_profile"]["first_name"] == "Bhavna"
    head = (await client.get(f"/api/v1/chats/{thread.id}", headers=H)).json()["data"]
    assert head["other_profile"]["user_id"] == str(b.id)

    # A sends over plain HTTP.
    r = await client.post(f"/api/v1/chats/{thread.id}/messages", json={"content": "  Hello Bhavna!  "}, headers=H)
    assert r.status_code == 200, r.text
    m1 = r.json()["data"]
    assert m1["sender_id"] == str(a.id) and m1["encrypted_content"] == "Hello Bhavna!"

    # B sees preview + unread, polls with ?after, then marks read.
    as_member(b)
    lst = (await client.get("/api/v1/chats", headers=H)).json()["data"]
    assert lst[0]["last_message_preview"] == "Hello Bhavna!" and lst[0]["unread_count"] == 1
    assert (await client.get("/api/v1/chats/unread-count", headers=H)).json()["data"]["unread"] == 1
    new = (await client.get(f"/api/v1/chats/{thread.id}/messages", params={"after": "2000-01-01T00:00:00"}, headers=H)).json()["data"]
    assert [m["id"] for m in new] == [m1["id"]]
    newer = (await client.get(f"/api/v1/chats/{thread.id}/messages", params={"after": m1["created_at"]}, headers=H)).json()["data"]
    assert newer == []

    note = (await db.execute(select(Notification).where(Notification.user_id == b.id, Notification.type == "message"))).scalar_one()
    assert note.action_url == f"/messages/{thread.id}" and "Arun" in note.title

    assert (await client.post(f"/api/v1/chats/{thread.id}/read", headers=H)).json()["data"]["marked"] == 1
    assert (await client.get("/api/v1/chats/unread-count", headers=H)).json()["data"]["unread"] == 0
    await db.refresh(note)
    assert note.is_read is True

    # Emails: B got "interest accepted"? No — A accepted B's interest, so B is
    # told; plus one message email for B.
    kinds = sorted(m["subject"] for m in _mail if m["to"] == b.email)
    assert any("accepted your interest" in s for s in kinds)
    assert any("sent you a message" in s for s in kinds)


@pytest.mark.asyncio
async def test_message_burst_is_coalesced_into_one_alert(client, db, _mail):
    t = await tenant(db)
    a, b, thread = await _matched(client, db, t)
    as_member(a)
    for i in range(3):
        assert (await client.post(f"/api/v1/chats/{thread.id}/messages", json={"content": f"msg {i}"}, headers=H)).status_code == 200
    notes = (await db.execute(select(Notification).where(Notification.user_id == b.id, Notification.type == "message"))).scalars().all()
    assert len(notes) == 1
    assert len([m for m in _mail if "sent you a message" in m["subject"]]) == 1


@pytest.mark.asyncio
async def test_email_respects_member_preference(client, db, _mail):
    t = await tenant(db)
    a, b, thread = await _matched(client, db, t)
    from app.routers.auth import _write_account_settings
    await _write_account_settings(db, b.id, {"notifications": {"email_messages": False}})
    as_member(a)
    await client.post(f"/api/v1/chats/{thread.id}/messages", json={"content": "hi"}, headers=H)
    assert not [m for m in _mail if "sent you a message" in m["subject"]]
    # …but the in-app notification still arrives.
    assert (await db.execute(select(Notification).where(Notification.user_id == b.id, Notification.type == "message"))).scalar_one()


@pytest.mark.asyncio
async def test_non_participant_cannot_read_or_send(client, db):
    t = await tenant(db)
    a, b, thread = await _matched(client, db, t)
    outsider = await _premium(db, t, "Chitra")
    as_member(outsider)
    assert (await client.get(f"/api/v1/chats/{thread.id}", headers=H)).status_code == 404
    assert (await client.get(f"/api/v1/chats/{thread.id}/messages", headers=H)).status_code == 404
    assert (await client.post(f"/api/v1/chats/{thread.id}/messages", json={"content": "x"}, headers=H)).status_code == 404


@pytest.mark.asyncio
async def test_basic_member_cannot_send(client, db):
    t = await tenant(db)
    a, b, thread = await _matched(client, db, t)
    a.subscription_tier = SubscriptionTier.FREE
    (await db.execute(select(Subscription).where(Subscription.user_id == a.id))).scalar_one().status = SubscriptionStatus.CANCELLED
    await db.flush()
    as_member(a)
    r = await client.post(f"/api/v1/chats/{thread.id}/messages", json={"content": "hi"}, headers=H)
    assert r.status_code == 403 and "Premium" in r.json()["detail"]


@pytest.mark.asyncio
async def test_cannot_message_a_deactivated_member_or_send_blank(client, db):
    t = await tenant(db)
    a, b, thread = await _matched(client, db, t)
    as_member(a)
    assert (await client.post(f"/api/v1/chats/{thread.id}/messages", json={"content": "   "}, headers=H)).status_code == 422
    assert (await client.post(f"/api/v1/chats/{thread.id}/messages", json={"content": "x" * 2001}, headers=H)).status_code == 422
    b.is_active = False
    await db.flush()
    assert (await client.post(f"/api/v1/chats/{thread.id}/messages", json={"content": "hi"}, headers=H)).status_code == 410
    assert (await db.execute(select(Message))).scalars().all() == []


@pytest.mark.asyncio
async def test_new_interest_notifies_receiver(client, db, _mail):
    t = await tenant(db)
    a, b = await member(db, t, first="Arun"), await member(db, t, first="Bhavna")
    as_member(a)
    await client.post(f"/api/v1/interests/{b.id}", headers=H)
    note = (await db.execute(select(Notification).where(Notification.user_id == b.id))).scalar_one()
    assert note.type == "interest" and "Arun is interested" in note.title
    assert note.action_url == f"/profile/{a.id}"
    assert any("interested in your profile" in m["subject"] for m in _mail)


@pytest.mark.asyncio
async def test_rematch_revives_soft_deleted_thread(client, db):
    from app.models.match import Interest
    t = await tenant(db)
    a, b, thread = await _matched(client, db, t)
    thread.deleted_at = datetime.utcnow()
    for i in (await db.execute(select(Interest))).scalars().all():
        await db.delete(i)
    await db.flush()
    a2, b2 = a, b
    as_member(b2)
    await client.post(f"/api/v1/interests/{a2.id}", headers=H)
    as_member(a2)
    r = await client.post(f"/api/v1/interests/{b2.id}", headers=H)
    assert r.status_code == 200, r.text
    threads = (await db.execute(select(ChatThread))).scalars().all()
    assert len(threads) == 1 and threads[0].deleted_at is None
