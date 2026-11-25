"""PECR: promotional admin emails go only to opted-in members and carry an opt-out footer."""
import uuid

import pytest

from app.models.tenant import Tenant
from app.models.user import User
from app.routers import admin_crm
from app.routers.admin_crm import MessageIn, _deliver


async def _users(db, n_opted_in: int, n_not: int):
    tenant = Tenant(id=uuid.uuid4(), slug=f"t{uuid.uuid4().hex[:6]}", name="T")
    db.add(tenant)
    await db.flush()
    rows = []
    for i in range(n_opted_in + n_not):
        opted = i < n_opted_in
        u = User(
            id=uuid.uuid4(), tenant_id=tenant.id, email=f"u{i}-{uuid.uuid4().hex[:4]}@example.com", firebase_uids=[],
            account_settings={"notifications": {"email_marketing": opted}},
        )
        db.add(u)
        rows.append((u, None))
    await db.flush()
    return tenant.id, rows


@pytest.mark.asyncio
async def test_promotional_email_skips_non_opted_in_and_adds_footer(db, monkeypatch):
    sent: list[dict] = []

    async def fake_single(to, subject, html, text, reply_to=None):
        sent.append({"to": to, "html": html, "text": text})
        return {"ok": True, "id": "x"}

    async def fake_batch(messages):
        sent.extend(messages)
        return [{"ok": True, "id": "x"} for _ in messages]

    monkeypatch.setattr(admin_crm, "send_admin_message_email", fake_single)
    monkeypatch.setattr(admin_crm, "send_admin_batch_emails", fake_batch)

    tenant_id, rows = await _users(db, n_opted_in=2, n_not=3)
    msg = MessageIn(channels=["email"], subject="Offer", body="Hello {{first_name}}", is_marketing=True)
    _, counts = await _deliver(db, tenant_uuid=tenant_id, current_user={"sub": str(uuid.uuid4())}, rows=rows, msg=msg)

    assert counts == {"sent": 2, "failed": 0, "skipped": 3}
    assert len(sent) == 2
    for m in sent:
        assert "Unsubscribe" in m["html"]
        assert "settings?section=notifications" in m["text"]


@pytest.mark.asyncio
async def test_service_email_reaches_everyone_without_footer(db, monkeypatch):
    sent: list[dict] = []

    async def fake_batch(messages):
        sent.extend(messages)
        return [{"ok": True, "id": "x"} for _ in messages]

    monkeypatch.setattr(admin_crm, "send_admin_batch_emails", fake_batch)

    tenant_id, rows = await _users(db, n_opted_in=1, n_not=2)
    msg = MessageIn(channels=["email"], subject="Service update", body="We updated our terms.")
    _, counts = await _deliver(db, tenant_uuid=tenant_id, current_user={"sub": str(uuid.uuid4())}, rows=rows, msg=msg)

    assert counts["sent"] == 3 and counts["skipped"] == 0
    assert all("Unsubscribe" not in m["html"] for m in sent)
