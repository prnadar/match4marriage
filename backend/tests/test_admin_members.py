"""
Admin member tools (routers/admin_members.py): Member 360, membership
management for offline payments, and editing a profile on a member's behalf.
Also the audit-of-views hooks and the legacy PUT 18+ fix.
"""
import uuid
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.admin_audit_log import AdminAuditLog
from app.models.match import ChatThread, Interest, InterestStatus, Match, MatchStatus, Message
from app.models.subscription import PaymentGateway, Subscription, SubscriptionStatus
from app.models.user import SubscriptionTier, User, UserProfile
from app.models.verification import Verification, VerificationStatus, VerificationType

from tests._admin_seed import HEADERS, as_admin, as_member, member, tenant

BASE = "/api/v1/admin/members"


@pytest.fixture(autouse=True)
def _no_real_infra(monkeypatch):
    # Never let the request-time column guard open a connection on the real engine.
    from app.routers import auth as auth_router
    monkeypatch.setattr(auth_router, "_account_settings_column_ready", True)


def _years_ago(n: int) -> date:
    t = date.today()
    try:
        return t.replace(year=t.year - n)
    except ValueError:
        return t.replace(year=t.year - n, day=28)


async def _audit(db, action: str, target: uuid.UUID) -> list[AdminAuditLog]:
    return list((await db.execute(
        select(AdminAuditLog).where(AdminAuditLog.action == action, AdminAuditLog.target_id == str(target))
    )).scalars().all())


async def _subs(db, user_id: uuid.UUID) -> list[Subscription]:
    return list((await db.execute(
        select(Subscription).where(Subscription.user_id == user_id).order_by(Subscription.created_at, Subscription.current_period_end)
    )).scalars().all())


GRANT = {"action": "grant", "plan": "gold", "payment_method": "bank_transfer", "amount_pence": 30000,
         "payment_reference": "BACS 4411", "reason": "Paid by bank transfer on the phone"}


# ── Authorisation + tenancy ─────────────────────────────────────────────────


@pytest.mark.parametrize("method,path,body", [
    ("get", "/overview", None),
    ("get", "/membership", None),
    ("post", "/membership", GRANT),
    ("get", "/profile", None),
    ("patch", "/profile", {"changes": {"city": "London"}, "reason": "typo fix"}),
])
async def test_non_admin_is_refused_everywhere(client, db, method, path, body):
    t = await tenant(db)
    u = await member(db, t)
    as_member(u)  # a signed-in member with no admin role, targeting themselves
    kw = {"headers": HEADERS}
    if body is not None:
        kw["json"] = body
    r = await getattr(client, method)(f"{BASE}/{u.id}{path}", **kw)
    assert r.status_code == 403, r.text


async def test_member_of_another_tenant_is_not_found(client, db):
    await tenant(db)
    other = await tenant(db, "other-bureau")
    stranger = await member(db, other)
    as_admin()
    for method, path, body in (
        ("get", "/overview", None),
        ("post", "/membership", GRANT),
        ("patch", "/profile", {"changes": {"city": "London"}, "reason": "typo fix"}),
    ):
        kw = {"headers": HEADERS, **({"json": body} if body else {})}
        r = await getattr(client, method)(f"{BASE}/{stranger.id}{path}", **kw)
        assert r.status_code == 404, (path, r.text)
    assert (await db.execute(select(User.subscription_tier).where(User.id == stranger.id))).scalar_one() == SubscriptionTier.FREE


# ── Member 360 ──────────────────────────────────────────────────────────────


async def test_overview_reports_activity_without_any_message_content(client, db):
    t = await tenant(db)
    u = await member(db, t)
    other = await member(db, t, first="Ravi", last="Shah")
    db.add_all([
        Interest(id=uuid.uuid4(), tenant_id=t.id, sender_id=u.id, receiver_id=other.id,
                 status=InterestStatus.ACCEPTED, message="PRIVATE-INTEREST-NOTE"),
        Match(id=uuid.uuid4(), tenant_id=t.id, user_a_id=u.id, user_b_id=other.id, compatibility_score=82.0,
              status=MatchStatus.MUTUAL, match_date="2026-11-01"),
    ])
    thread = ChatThread(id=uuid.uuid4(), tenant_id=t.id, user_a_id=u.id, user_b_id=other.id,
                        last_message_preview="PRIVATE-PREVIEW", last_message_at=datetime(2026, 11, 20, 10, 0))
    db.add(thread)
    await db.flush()
    db.add_all([
        Message(id=uuid.uuid4(), tenant_id=t.id, thread_id=thread.id, sender_id=u.id, encrypted_content="PRIVATE-BODY-1"),
        Message(id=uuid.uuid4(), tenant_id=t.id, thread_id=thread.id, sender_id=u.id, encrypted_content="PRIVATE-BODY-2"),
        Message(id=uuid.uuid4(), tenant_id=t.id, thread_id=thread.id, sender_id=other.id, encrypted_content="PRIVATE-BODY-3"),
    ])
    await db.flush()
    as_admin()

    r = await client.get(f"{BASE}/{u.id}/overview", headers=HEADERS)
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["sections_failed"] == []
    assert d["interests"]["sent"]["total"] == 1 and d["interests"]["sent"]["by_status"] == {"accepted": 1}
    assert d["interests"]["sent"]["items"][0]["member"]["name"] == "Ravi Shah"
    assert d["interests"]["received"]["total"] == 0
    assert d["matches"]["by_status"] == {"mutual": 1} and d["matches"]["items"][0]["score"] == 82
    assert d["chat"] == {**d["chat"], "threads": 1, "messages_sent": 2, "messages_received": 1}
    assert d["account"]["state"] == "active" and d["billing"]["membership"]["tier"] == "free"
    for secret in ("PRIVATE-BODY", "PRIVATE-PREVIEW", "PRIVATE-INTEREST-NOTE"):
        assert secret not in r.text


# ── Membership management ───────────────────────────────────────────────────


async def test_grant_creates_manual_subscription_sets_tier_and_audits(client, db):
    t = await tenant(db)
    u = await member(db, t)
    as_admin()

    r = await client.post(f"{BASE}/{u.id}/membership", json=GRANT, headers=HEADERS)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["tier"] == "gold" and r.json()["data"]["plan_label"] == "Premium"

    subs = await _subs(db, u.id)
    assert len(subs) == 1
    s = subs[0]
    assert (s.plan, s.status, s.gateway, s.amount_paise, s.currency) == ("gold", SubscriptionStatus.ACTIVE, PaymentGateway.MANUAL, 30000, "GBP")
    assert s.gateway_subscription_id.startswith("manual-")
    assert 179 <= (s.current_period_end - s.current_period_start).days <= 180  # the standard 6-month term
    assert s.monthly_interests == -1  # same feature shape a PayPal activation writes
    assert s.raw_webhook_data["reason"] == GRANT["reason"] and s.raw_webhook_data["payment_reference"] == "BACS 4411"
    await db.refresh(u)
    assert u.subscription_tier == SubscriptionTier.GOLD

    rows = await _audit(db, "membership.grant", u.id)
    assert len(rows) == 1
    assert rows[0].summary == GRANT["reason"] and rows[0].actor_email == "staff@example.com"
    assert rows[0].details["plan_to"] == "gold" and rows[0].details["amount_pence"] == 30000


@pytest.mark.parametrize("patch,expected", [
    ({"reason": "  "}, 422),                                   # reason is mandatory
    ({"reason": "ok"}, 422),                                   # ...and has to say something
    ({"plan": None}, 422),                                     # no plan
    ({"plan": "diamond"}, 422),                                # unknown plan
    ({"payment_method": None}, 422),                           # how did they pay?
    ({"amount_pence": 0}, 422),                                # paid method needs an amount
    ({"payment_method": "complimentary"}, 422),                # complimentary can't carry an amount
    ({"days": 30, "period_end": "2030-01-01"}, 422),           # one or the other
    ({"period_end": "2020-01-01"}, 422),                       # must be in the future
    ({"days": 5000}, 422),                                     # too long
    ({"tier": "platinum"}, 422),                               # unknown fields are rejected
])
async def test_grant_validation(client, db, patch, expected):
    t = await tenant(db)
    u = await member(db, t)
    as_admin()
    r = await client.post(f"{BASE}/{u.id}/membership", json={**GRANT, **patch}, headers=HEADERS)
    assert r.status_code == expected, r.text
    assert await _subs(db, u.id) == []
    await db.refresh(u)
    assert u.subscription_tier == SubscriptionTier.FREE
    assert await _audit(db, "membership.grant", u.id) == []


async def test_complimentary_grant_and_no_double_grant(client, db):
    t = await tenant(db)
    u = await member(db, t)
    as_admin()
    body = {"action": "grant", "plan": "silver", "payment_method": "complimentary", "days": 90, "reason": "Goodwill after a complaint"}
    r = await client.post(f"{BASE}/{u.id}/membership", json=body, headers=HEADERS)
    assert r.status_code == 200, r.text
    assert (await _subs(db, u.id))[0].amount_paise == 0
    r = await client.post(f"{BASE}/{u.id}/membership", json=GRANT, headers=HEADERS)
    assert r.status_code == 409 and "Extend or Change" in r.text
    assert len(await _subs(db, u.id)) == 1


async def test_extend_moves_the_end_date_and_refuses_to_shorten(client, db):
    t = await tenant(db)
    u = await member(db, t)
    as_admin()
    await client.post(f"{BASE}/{u.id}/membership", json=GRANT, headers=HEADERS)
    before = (await _subs(db, u.id))[0].current_period_end

    r = await client.post(f"{BASE}/{u.id}/membership", json={"action": "extend", "days": 30, "reason": "Away for a month"}, headers=HEADERS)
    assert r.status_code == 200, r.text
    subs = await _subs(db, u.id)
    assert len(subs) == 1 and subs[0].current_period_end == before + timedelta(days=30)
    assert subs[0].raw_webhook_data["admin_events"][-1]["type"] == "extend"
    assert len(await _audit(db, "membership.extend", u.id)) == 1

    earlier = (datetime.utcnow() + timedelta(days=10)).date().isoformat()
    r = await client.post(f"{BASE}/{u.id}/membership", json={"action": "extend", "period_end": earlier, "reason": "trying to shorten"}, headers=HEADERS)
    assert r.status_code == 422 and "later" in r.text
    r = await client.post(f"{BASE}/{u.id}/membership", json={"action": "extend", "reason": "no duration given"}, headers=HEADERS)
    assert r.status_code == 422


async def test_paid_extension_is_a_new_row_and_keeps_revenue_history(client, db):
    t = await tenant(db)
    u = await member(db, t)
    as_admin()
    await client.post(f"{BASE}/{u.id}/membership", json=GRANT, headers=HEADERS)
    r = await client.post(f"{BASE}/{u.id}/membership", json={
        "action": "extend", "days": 180, "payment_method": "cash", "amount_pence": 30000, "reason": "Renewed in the office",
    }, headers=HEADERS)
    assert r.status_code == 200, r.text
    subs = await _subs(db, u.id)
    assert sorted(s.status.value for s in subs) == ["active", "expired"]  # old term closed, NOT cancelled
    assert sum(s.amount_paise for s in subs) == 60000
    assert r.json()["data"]["active_count"] == 1


async def test_extend_without_a_membership_is_refused(client, db):
    t = await tenant(db)
    u = await member(db, t)
    as_admin()
    r = await client.post(f"{BASE}/{u.id}/membership", json={"action": "extend", "days": 30, "reason": "nothing to extend"}, headers=HEADERS)
    assert r.status_code == 409


async def test_downgrade_and_end_need_explicit_confirmation(client, db):
    t = await tenant(db)
    u = await member(db, t)
    as_admin()
    await client.post(f"{BASE}/{u.id}/membership", json={**GRANT, "plan": "platinum", "amount_pence": 100000}, headers=HEADERS)

    down = {"action": "change", "plan": "silver", "reason": "Asked to move to Basic"}
    r = await client.post(f"{BASE}/{u.id}/membership", json=down, headers=HEADERS)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "confirm_required"
    await db.refresh(u)
    assert u.subscription_tier == SubscriptionTier.PLATINUM  # nothing changed

    r = await client.post(f"{BASE}/{u.id}/membership", json={**down, "confirm": True}, headers=HEADERS)
    assert r.status_code == 200, r.text
    await db.refresh(u)
    assert u.subscription_tier == SubscriptionTier.SILVER
    subs = await _subs(db, u.id)
    assert sorted((s.plan, s.status.value) for s in subs) == [("platinum", "expired"), ("silver", "active")]
    active = next(s for s in subs if s.status == SubscriptionStatus.ACTIVE)
    old = next(s for s in subs if s.status == SubscriptionStatus.EXPIRED)
    assert active.current_period_end == old.current_period_end  # time already paid for is kept
    assert (await _audit(db, "membership.change", u.id))[0].details["downgrade"] is True

    end = {"action": "end", "reason": "Member asked to stop"}
    r = await client.post(f"{BASE}/{u.id}/membership", json=end, headers=HEADERS)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "confirm_required"
    r = await client.post(f"{BASE}/{u.id}/membership", json={**end, "confirm": True}, headers=HEADERS)
    assert r.status_code == 200, r.text
    await db.refresh(u)
    assert u.subscription_tier == SubscriptionTier.FREE
    assert all(s.status == SubscriptionStatus.EXPIRED for s in await _subs(db, u.id))
    assert len(await _audit(db, "membership.end", u.id)) == 1

    r = await client.post(f"{BASE}/{u.id}/membership", json={**end, "confirm": True}, headers=HEADERS)
    assert r.status_code == 409  # nothing left to end


async def test_end_with_refund_marks_rows_cancelled(client, db):
    t = await tenant(db)
    u = await member(db, t)
    as_admin()
    await client.post(f"{BASE}/{u.id}/membership", json=GRANT, headers=HEADERS)
    r = await client.post(f"{BASE}/{u.id}/membership", json={"action": "end", "refunded": True, "confirm": True, "reason": "Refunded in full"}, headers=HEADERS)
    assert r.status_code == 200, r.text
    s = (await _subs(db, u.id))[0]
    assert s.status == SubscriptionStatus.CANCELLED and s.cancelled_at is not None


async def test_upgrade_needs_no_confirmation_and_membership_get_flags_a_lapsed_period(client, db):
    t = await tenant(db)
    u = await member(db, t, subscription_tier=SubscriptionTier.SILVER)
    past = datetime.utcnow() - timedelta(days=3)
    db.add(Subscription(id=uuid.uuid4(), tenant_id=t.id, user_id=u.id, plan="silver", status=SubscriptionStatus.ACTIVE,
                        gateway=PaymentGateway.PAYPAL, gateway_subscription_id="PP-1", amount_paise=10000, currency="GBP",
                        current_period_start=past - timedelta(days=180), current_period_end=past, raw_webhook_data={}))
    await db.flush()
    as_admin()

    r = await client.get(f"{BASE}/{u.id}/membership", headers=HEADERS)
    d = r.json()["data"]
    assert d["period_lapsed"] is True and d["warnings"] and [p["plan"] for p in d["plans"]] == ["silver", "gold", "platinum"]

    r = await client.post(f"{BASE}/{u.id}/membership", json={"action": "change", "plan": "gold", "payment_method": "cash", "amount_pence": 20000, "reason": "Upgraded at the event"}, headers=HEADERS)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["tier"] == "gold" and r.json()["data"]["period_lapsed"] is False


async def test_deleted_account_membership_cannot_be_changed(client, db):
    t = await tenant(db)
    u = await member(db, t, deleted_at=datetime.utcnow(), is_active=False)
    as_admin()
    r = await client.post(f"{BASE}/{u.id}/membership", json=GRANT, headers=HEADERS)
    assert r.status_code == 409


# ── Edit profile on a member's behalf ───────────────────────────────────────


async def test_profile_edit_applies_safe_fields_with_reason_and_audit(client, db):
    t = await tenant(db)
    u = await member(db, t)
    as_admin()

    r = await client.get(f"{BASE}/{u.id}/profile", headers=HEADERS)
    assert r.status_code == 200 and r.json()["data"]["values"]["city"] == "Lodon"
    assert "religion" not in {f["key"] for f in r.json()["data"]["fields"]}

    r = await client.patch(f"{BASE}/{u.id}/profile", json={
        "changes": {"city": "  London ", "occupation": "Pharmacist", "country": "United Kingdom"},
        "reason": "Member phoned: city was misspelt",
    }, headers=HEADERS)
    assert r.status_code == 200, r.text
    assert sorted(r.json()["data"]["changed"]) == ["city", "occupation"]  # unchanged country isn't a change

    p = (await db.execute(select(UserProfile).where(UserProfile.user_id == u.id))).scalar_one()
    await db.refresh(p)
    assert (p.city, p.occupation, p.version) == ("London", "Pharmacist", 1)

    rows = await _audit(db, "profile.admin_edit", u.id)
    assert len(rows) == 1 and rows[0].summary == "Member phoned: city was misspelt"
    assert rows[0].details["changes"]["city"] == "Lodon → London"


@pytest.mark.parametrize("body", [
    {"changes": {"city": "London"}},                                        # no reason
    {"changes": {"city": "London"}, "reason": "x"},                         # reason too thin
    {"changes": {}, "reason": "nothing to change"},                         # empty
    {"changes": {"religion": "hindu"}, "reason": "not an admin field"},     # special-category data
    {"changes": {"bio": "rewritten"}, "reason": "not an admin field"},      # the member's own words
    {"changes": {"photos": []}, "reason": "not an admin field"},
    {"changes": {"verification_status": "approved"}, "reason": "sneaky"},   # can't approve via edit
    {"changes": {"first_name": ""}, "reason": "blanking a required field"},
    {"changes": {"country": None}, "reason": "blanking a required field"},
    {"changes": {"height_cm": 900}, "reason": "out of range value"},
    {"changes": {"gender": "robot"}, "reason": "not a valid choice"},
    {"changes": {"city": "x" * 101}, "reason": "longer than the column"},
])
async def test_profile_edit_rejects_unsafe_or_invalid_input(client, db, body):
    t = await tenant(db)
    u = await member(db, t)
    as_admin()
    r = await client.patch(f"{BASE}/{u.id}/profile", json=body, headers=HEADERS)
    assert r.status_code == 422, r.text
    p = (await db.execute(select(UserProfile).where(UserProfile.user_id == u.id))).scalar_one()
    assert (p.city, p.first_name, p.version or 0) == ("Lodon", "Asha", 0)
    assert await _audit(db, "profile.admin_edit", u.id) == []


async def test_profile_edit_enforces_the_18_plus_rule(client, db):
    t = await tenant(db)
    u = await member(db, t, dob=_years_ago(30))
    as_admin()
    r = await client.patch(f"{BASE}/{u.id}/profile", json={"changes": {"date_of_birth": _years_ago(16).isoformat()}, "reason": "DOB correction"}, headers=HEADERS)
    assert r.status_code == 422 and "18" in r.text
    r = await client.patch(f"{BASE}/{u.id}/profile", json={"changes": {"date_of_birth": _years_ago(28).isoformat()}, "reason": "DOB correction"}, headers=HEADERS)
    assert r.status_code == 200, r.text


async def test_profile_edit_needs_a_profile_and_a_live_account(client, db):
    t = await tenant(db)
    bare = await member(db, t, profile=False)
    gone = await member(db, t, deleted_at=datetime.utcnow(), is_active=False)
    as_admin()
    for u in (bare, gone):
        r = await client.patch(f"{BASE}/{u.id}/profile", json={"changes": {"city": "London"}, "reason": "typo fix"}, headers=HEADERS)
        assert r.status_code == 409, r.text


async def test_legacy_put_now_applies_the_18_plus_rule(client, db):
    t = await tenant(db)
    u = await member(db, t, dob=_years_ago(30))
    as_member(u)
    r = await client.put(f"/api/v1/profile/{u.id}", json={"date_of_birth": _years_ago(15).isoformat()}, headers=HEADERS)
    assert r.status_code == 422, r.text
    r = await client.put(f"/api/v1/profile/{uuid.uuid4()}", json={"city": "London"}, headers=HEADERS)
    assert r.status_code == 403  # and it is still self-only


# ── Audit of views ──────────────────────────────────────────────────────────


async def test_opening_contact_details_is_audited_once_per_window(client, db):
    t = await tenant(db)
    u = await member(db, t)
    admin = as_admin()
    for _ in range(3):
        r = await client.get(f"/api/v1/admin/users/{u.id}", headers=HEADERS)
        assert r.status_code == 200, r.text
    rows = await _audit(db, "access.view_contact", u.id)
    assert len(rows) == 1 and str(rows[0].actor_id) == admin["sub"] and rows[0].details["surface"] == "member_page"

    # A different admin opening the same member is a separate event…
    as_admin()
    await client.get(f"/api/v1/admin/users/{u.id}", headers=HEADERS)
    assert len(await _audit(db, "access.view_contact", u.id)) == 2

    # …and so is the first admin's view once the window has passed.
    rows[0].created_at = datetime.utcnow() - timedelta(hours=2)
    await db.flush()
    as_admin(uuid.UUID(admin["sub"]))
    await client.get(f"/api/v1/admin/users/{u.id}", headers=HEADERS)
    assert len(await _audit(db, "access.view_contact", u.id)) == 3


async def test_opening_identity_documents_is_audited(client, db):
    t = await tenant(db)
    u = await member(db, t)
    db.add(Verification(id=uuid.uuid4(), tenant_id=t.id, user_id=u.id, verification_type=VerificationType.PHOTO_LIVENESS,
                        status=VerificationStatus.IN_REVIEW,
                        provider_response={"doc_type": "passport", "doc_number": "123456789", "front": {"url": "https://img.example/f.jpg"}}))
    await db.flush()
    as_admin()
    for _ in range(2):
        r = await client.get(f"/api/v1/admin/verification-review/{u.id}", headers=HEADERS)
        assert r.status_code == 200, r.text
    rows = await _audit(db, "access.view_documents", u.id)
    assert len(rows) == 1 and rows[0].details == {"documents": 1, "surface": "verification_review"}
    assert await _audit(db, "access.view_contact", u.id) == []
