"""Bot / spam protection for the public enquiry form."""
import uuid

import pytest
from sqlalchemy import select

from app.core.rate_limit import limiter
from app.models.enquiry import Enquiry, EnquiryStatus
from app.routers import enquiries as enq_router
from app.services.spam import is_certain_bot, spam_reason
from tests._admin_seed import as_admin, tenant

H = {"X-Tenant-ID": "match4marriage"}


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    # No team emails and no rate-limit carry-over between tests.
    async def _no_mail(**kw):
        _no_mail.calls.append(kw)
    _no_mail.calls = []
    import app.services.email as email_svc
    monkeypatch.setattr(email_svc, "send_enquiry_notification_email", _no_mail)
    limiter.reset()
    yield _no_mail
    limiter.reset()


def _body(**over):
    b = {
        "name": "Lakshmi Iyer",
        "email": f"lakshmi{uuid.uuid4().hex[:6]}@example.com",
        "subject": "Membership for my daughter",
        "message": "Hello, we would like to know more about the Elite plan for our daughter in London.",
        "source": "contact_form",
        "website": "",
        "elapsed_ms": 42000,
    }
    b.update(over)
    return b


async def _rows(db):
    return (await db.execute(select(Enquiry))).scalars().all()


# ── Heuristics (pure) ────────────────────────────────────────────────────────

def test_real_enquiries_are_not_spam():
    assert spam_reason("Priya Sharma", "p@gmail.com", "Elite plan", "Could you call my father about the Elite plan? Thanks.") is None
    # Indian scripts must never be penalised.
    assert spam_reason("முருகன்", None, None, "என் மகளுக்கு வரன் தேடுகிறோம். தயவுசெய்து தொடர்பு கொள்ளவும்.") is None
    assert spam_reason("राजेश", None, None, "मेरे बेटे के लिए रिश्ता चाहिए, कृपया संपर्क करें।") is None
    # One link on its own is fine (e.g. sharing a biodata).
    assert spam_reason("Anil", "a@x.com", None, "Biodata is here: https://drive.google.com/abc") is None


@pytest.mark.parametrize("name,msg", [
    ("Get rich http://x.io", "hello"),
    ("Mark", "Visit https://a.io https://b.io https://c.io now"),
    ("Mark", "We do SEO and backlinks for your site https://cheap-seo.io"),
    ("Mark", "Dear website owner, crypto and forex investment opportunity"),
    ("Ivan", "Привет, предлагаем продвижение вашего сайта в поисковых системах быстро"),
    ("Bob", "[url=http://spam.io]click[/url]"),
])
def test_spam_patterns_are_caught(name, msg):
    assert spam_reason(name, "x@y.com", None, msg)


def test_certain_bot_signals():
    assert is_certain_bot("http://bot.io", 50000) == "honeypot"
    assert is_certain_bot("", 800) == "too_fast"
    assert is_certain_bot(None, None) is None           # older clients send no timing
    assert is_certain_bot("", "not-a-number") is None   # malformed timing is ignored
    assert is_certain_bot("", 30000) is None


# ── Endpoint ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_real_enquiry_is_stored_and_emailed(client, db, _isolate):
    await tenant(db)
    r = await client.post("/api/v1/enquiries", json=_body(), headers=H)
    assert r.status_code == 200, r.text
    rows = await _rows(db)
    assert len(rows) == 1 and rows[0].status == EnquiryStatus.NEW
    assert len(_isolate.calls) == 1


@pytest.mark.asyncio
async def test_honeypot_and_too_fast_are_dropped_silently(client, db, _isolate):
    await tenant(db)
    for body in (_body(website="http://bot.io"), _body(elapsed_ms=400)):
        r = await client.post("/api/v1/enquiries", json=body, headers=H)
        assert r.status_code == 200 and r.json()["success"] is True  # bot learns nothing
    assert await _rows(db) == []
    assert _isolate.calls == []


@pytest.mark.asyncio
async def test_spam_content_is_filed_as_spam_without_email(client, db, _isolate):
    await tenant(db)
    r = await client.post("/api/v1/enquiries", json=_body(
        name="SEO Pro", message="Boost your SEO with backlinks https://a.io https://b.io https://c.io"), headers=H)
    assert r.status_code == 200
    rows = await _rows(db)
    assert len(rows) == 1 and rows[0].status == EnquiryStatus.SPAM
    assert "Auto-flagged as spam" in (rows[0].admin_notes or "")
    assert _isolate.calls == []


@pytest.mark.asyncio
async def test_duplicate_within_a_day_is_not_stored_twice(client, db):
    await tenant(db)
    body = _body()
    await client.post("/api/v1/enquiries", json=body, headers=H)
    await client.post("/api/v1/enquiries", json=body, headers=H)
    assert len(await _rows(db)) == 1


@pytest.mark.asyncio
async def test_rate_limit_per_visitor_ip(client, db):
    await tenant(db)
    codes = []
    for i in range(4):
        r = await client.post("/api/v1/enquiries", json=_body(message=f"Genuine question number {i} about plans."),
                              headers={**H, "X-Forwarded-For": "203.0.113.7"})
        codes.append(r.status_code)
    assert codes[:3] == [200, 200, 200] and codes[3] == 429
    # A different visitor is unaffected.
    r = await client.post("/api/v1/enquiries", json=_body(), headers={**H, "X-Forwarded-For": "198.51.100.9"})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_admin_all_excludes_spam_and_scan_then_empty(client, db):
    t = await tenant(db)
    db.add_all([
        Enquiry(tenant_id=t.id, name="Real Person", email="r@example.com", message="Please call me about Premium.",
                status=EnquiryStatus.NEW),
        Enquiry(tenant_id=t.id, name="Bot", email="b@example.com",
                message="cheap SEO backlinks https://a.io https://b.io https://c.io", status=EnquiryStatus.NEW),
    ])
    await db.flush()
    as_admin()

    r = await client.post("/api/v1/admin/enquiries/spam/scan", headers=H)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["flagged"] == 1

    all_rows = (await client.get("/api/v1/admin/enquiries", headers=H)).json()["data"]
    assert [e["name"] for e in all_rows] == ["Real Person"]
    counts = (await client.get("/api/v1/admin/enquiries/counts", headers=H)).json()["data"]
    assert counts["spam"] == 1 and counts["total"] == 1

    r = await client.post("/api/v1/admin/enquiries/spam/empty", headers=H)
    assert r.json()["data"]["deleted"] == 1
    counts = (await client.get("/api/v1/admin/enquiries/counts", headers=H)).json()["data"]
    assert counts["spam"] == 0


@pytest.mark.asyncio
async def test_spam_admin_actions_require_admin(client, db):
    await tenant(db)
    from app.core.security import get_current_user
    from app.main import app
    app.dependency_overrides[get_current_user] = lambda: {"sub": str(uuid.uuid4()), "email": "m@example.com"}
    for path in ("/api/v1/admin/enquiries/spam/scan", "/api/v1/admin/enquiries/spam/empty"):
        assert (await client.post(path, headers=H)).status_code in (401, 403)
