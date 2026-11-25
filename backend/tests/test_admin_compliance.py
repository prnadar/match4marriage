"""
Admin compliance console (routers/admin_compliance.py): consent register,
data requests (deactivated / deleted accounts) and integrations health.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update

from app.models.admin_audit_log import AdminAuditLog
from app.models.consent import UserConsent
from app.models.user import User, UserProfile
from app.routers.consents import POLICY_VERSION

from tests._admin_seed import HEADERS, as_admin, as_member, member, tenant

A = "/api/v1/admin"
OLD_VERSION = "2025-01-01"


@pytest.fixture(autouse=True)
def _no_real_infra(monkeypatch):
    """Nothing in these tests may touch the real database engine, Redis,
    Firebase or any provider API."""
    import fakeredis.aioredis as fakeredis
    from app.core import firebase as firebase_core
    from app.core import redis as redis_core
    from app.routers import admin_compliance as ac
    from app.routers import auth as auth_router

    monkeypatch.setattr(auth_router, "_account_settings_column_ready", True)
    fake = fakeredis.FakeRedis(decode_responses=True)

    async def _get_redis():
        return fake

    monkeypatch.setattr(redis_core, "get_redis", _get_redis)
    monkeypatch.setattr(firebase_core, "get_firebase_app", lambda: None)

    def _boom(*a, **k):
        raise AssertionError("a live provider probe ran without being stubbed")

    monkeypatch.setattr(ac, "_http_get", _boom)
    monkeypatch.setattr(ac, "_probe_firebase", _boom)
    monkeypatch.setattr(ac, "_probe_paypal", _boom)


_tick = 0


async def consent(db, t, u, ctype: str, granted: bool = True, version: str = POLICY_VERSION, source: str = "signup", days_ago: float = 1.0):
    global _tick
    _tick += 1  # strictly increasing timestamps so "latest" is unambiguous
    row = UserConsent(
        id=uuid.uuid4(), tenant_id=t.id, user_id=u.id, consent_type=ctype, granted=granted,
        policy_version=version, source=source, ip_address="203.0.113.7", user_agent="pytest",
        created_at=datetime.now(timezone.utc) - timedelta(days=days_ago) + timedelta(seconds=_tick),
    )
    db.add(row)
    await db.flush()
    return row


async def _audit(db, action: str) -> list[AdminAuditLog]:
    return list((await db.execute(select(AdminAuditLog).where(AdminAuditLog.action == action))).scalars().all())


async def _population(db):
    """Four members in the tenant, one in another tenant:
       confirmed — both required consents at the current version, marketing in
       outdated  — both required consents, but at an old policy version
       withdrew  — accepted, then withdrew sensitive-data consent; marketing in → out
       never     — nothing on record
    """
    t = await tenant(db)
    other = await tenant(db, "other-bureau")
    confirmed = await member(db, t, first="Confirmed", last="Member")
    outdated = await member(db, t, first="Outdated", last="Member")
    withdrew = await member(db, t, first="Withdrew", last="Member")
    never = await member(db, t, first="Never", last="Member")
    stranger = await member(db, other, first="Other", last="Tenant")

    for ct in ("terms_privacy", "sensitive_data", "marketing_email"):
        await consent(db, t, confirmed, ct)
    for ct in ("terms_privacy", "sensitive_data"):
        await consent(db, t, outdated, ct, version=OLD_VERSION, days_ago=200)
        await consent(db, t, withdrew, ct, days_ago=5)
    await consent(db, t, withdrew, "marketing_email", True, days_ago=5)
    await consent(db, t, withdrew, "sensitive_data", False, source="settings", days_ago=2)
    await consent(db, t, withdrew, "marketing_email", False, source="settings", days_ago=2)
    for ct in ("terms_privacy", "sensitive_data", "marketing_email"):
        await consent(db, other, stranger, ct)
    return t, {"confirmed": confirmed, "outdated": outdated, "withdrew": withdrew, "never": never, "stranger": stranger}


# ── Authorisation ───────────────────────────────────────────────────────────


@pytest.mark.parametrize("method,path", [
    ("get", "/consents/summary"), ("get", "/consents"), ("get", "/consents?format=csv"),
    ("get", "/consents/members"), ("get", "/consents/member/{id}"),
    ("get", "/data-requests"), ("get", "/data-requests/{id}/export"), ("post", "/data-requests/{id}/restore"),
    ("get", "/integrations"),
])
async def test_non_admin_is_refused_everywhere(client, db, method, path):
    t = await tenant(db)
    u = await member(db, t)
    as_member(u)
    kw = {"headers": HEADERS, **({"json": {"reason": "please restore me"}} if method == "post" else {})}
    r = await getattr(client, method)(A + path.replace("{id}", str(u.id)), **kw)
    assert r.status_code == 403, r.text


# ── Consent register ────────────────────────────────────────────────────────


async def test_consent_summary_counts_current_state_per_member(client, db):
    await _population(db)
    as_admin()
    r = await client.get(f"{A}/consents/summary", headers=HEADERS)
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["policy_version"] == POLICY_VERSION
    assert (d["members_total"], d["confirmed_current"], d["not_confirmed"]) == (4, 1, 3)
    assert (d["outdated_version"], d["incomplete"], d["never_recorded"]) == (1, 1, 1)
    assert (d["marketing_opt_in"], d["marketing_opt_out"], d["marketing_no_answer"]) == (1, 1, 2)
    assert d["marketing_opt_in_rate"] == 25.0 and d["confirmed_rate"] == 25.0
    assert d["events_total"] == 10  # the other tenant's 3 rows are not counted
    assert d["by_type"]["sensitive_data"] == {"granted": 2, "withdrawn": 1, "none": 1, "granted_current_version": 1}


async def test_member_consent_table_filters(client, db):
    _, m = await _population(db)
    as_admin()

    async def names(qs: str) -> list[str]:
        r = await client.get(f"{A}/consents/members{qs}", headers=HEADERS)
        assert r.status_code == 200, r.text
        return sorted(i["name"].split()[0] for i in r.json()["data"])

    assert await names("") == ["Confirmed", "Never", "Outdated", "Withdrew"]
    assert await names("?status=confirmed") == ["Confirmed"]
    assert await names("?status=not_confirmed") == ["Never", "Outdated", "Withdrew"]
    assert await names("?status=outdated") == ["Outdated"]
    assert await names("?status=incomplete") == ["Withdrew"]
    assert await names("?status=never") == ["Never"]
    assert await names("?marketing=in") == ["Confirmed"]
    assert await names("?marketing=out") == ["Withdrew"]
    assert await names("?marketing=none") == ["Never", "Outdated"]
    assert await names("?q=withd") == ["Withdrew"]
    assert await names(f"?q={m['stranger'].email}") == []  # other tenant never leaks
    assert (await client.get(f"{A}/consents/members?status=bogus", headers=HEADERS)).status_code == 400


async def test_consent_log_filters_and_pagination(client, db):
    _, m = await _population(db)
    as_admin()

    async def total(qs: str) -> int:
        r = await client.get(f"{A}/consents{qs}", headers=HEADERS)
        assert r.status_code == 200, r.text
        return r.json()["total"]

    assert await total("") == 10
    assert await total("?consent_type=marketing_email") == 3
    assert await total("?granted=false") == 2
    assert await total("?version=older") == 2
    assert await total("?version=current") == 8
    assert await total(f"?version={OLD_VERSION}") == 2
    assert await total("?source=settings") == 2
    assert await total(f"?user_id={m['withdrew'].id}") == 5
    assert await total(f"?user_id={m['stranger'].id}") == 0
    assert await total("?days=30") == 8
    assert await total("?q=outdated") == 2
    assert (await client.get(f"{A}/consents?consent_type=nope", headers=HEADERS)).status_code == 400

    r = await client.get(f"{A}/consents?limit=3&page=4", headers=HEADERS)
    body = r.json()
    assert len(body["data"]) == 1 and body["has_next"] is False
    newest = (await client.get(f"{A}/consents?limit=1", headers=HEADERS)).json()["data"][0]
    # Newest first: the confirmed member's marketing opt-in was the last decision recorded.
    assert (newest["member_name"], newest["consent_type"], newest["granted"]) == ("Confirmed Member", "marketing_email", True)
    assert newest["ip_address"] == "203.0.113.7" and newest["is_current_version"] is True


async def test_consent_csv_exports_are_filtered_and_audited(client, db):
    await _population(db)
    as_admin()
    r = await client.get(f"{A}/consents?format=csv&granted=false", headers=HEADERS)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("created_at,member_name,member_email") and len(lines) == 3
    assert "Other Tenant" not in r.text

    r = await client.get(f"{A}/consents/members?format=csv&status=not_confirmed", headers=HEADERS)
    assert r.status_code == 200 and len(r.text.strip().splitlines()) == 4
    assert "consent-status.csv" in r.headers["content-disposition"]

    rows = await _audit(db, "access.export_consents")
    assert sorted((a.details["view"], a.details["rows"]) for a in rows) == [("events", 2), ("members", 3)]


async def test_consent_csv_neutralises_spreadsheet_formulas(client, db):
    t = await tenant(db)
    u = await member(db, t, first="=HYPERLINK(\"http://evil.example\")", last="X")
    row = await consent(db, t, u, "marketing_email")
    row.user_agent = "@SUM(1+1)"
    await db.flush()
    as_admin()
    r = await client.get(f"{A}/consents?format=csv", headers=HEADERS)
    assert r.status_code == 200
    assert "'=HYPERLINK" in r.text and "'@SUM(1+1)" in r.text
    assert ",=HYPERLINK" not in r.text and ",@SUM" not in r.text
    r = await client.get(f"{A}/consents/members?format=csv", headers=HEADERS)
    assert "'=HYPERLINK" in r.text and "\n=HYPERLINK" not in r.text


async def test_member_consent_history(client, db):
    _, m = await _population(db)
    as_admin()
    r = await client.get(f"{A}/consents/member/{m['withdrew'].id}", headers=HEADERS)
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["status"] == "incomplete" and d["needs_consent"] is True and len(d["history"]) == 5
    assert d["current"]["sensitive_data"]["granted"] is False and d["current"]["sensitive_data"]["source"] == "settings"
    assert d["current"]["terms_privacy"]["granted"] is True and d["current"]["terms_privacy"]["required"] is True
    assert d["history"][0]["created_at"] >= d["history"][-1]["created_at"]

    assert (await client.get(f"{A}/consents/member/{m['confirmed'].id}", headers=HEADERS)).json()["data"]["status"] == "confirmed"
    assert (await client.get(f"{A}/consents/member/{m['never'].id}", headers=HEADERS)).json()["data"]["history"] == []
    assert (await client.get(f"{A}/consents/member/{m['stranger'].id}", headers=HEADERS)).status_code == 404


# ── Data requests ───────────────────────────────────────────────────────────


async def _requests(db):
    t = await tenant(db)
    other = await tenant(db, "other-bureau")
    now = datetime.now(timezone.utc)
    live = await member(db, t, first="Live", last="Member")
    suspended = await member(db, t, first="Suspended", last="ByStaff", is_active=False)
    self_deleted = await member(db, t, first="Self", last="Deleted", is_active=False, deleted_at=now - timedelta(days=45))
    admin_deleted = await member(db, t, first="Staff", last="Deleted", is_active=False, deleted_at=now - timedelta(days=3))
    deactivated = await member(db, t, first="Self", last="Deactivated", is_active=False)
    stranger = await member(db, other, first="Other", last="Tenant", is_active=False, deleted_at=now)

    # What POST /auth/delete-account leaves behind: contact moved into the tombstone.
    await db.execute(update(User).where(User.id == self_deleted.id).values(
        email=None, phone=None,
        account_settings={"deletion": {"at": (now - timedelta(days=45)).isoformat(), "by": "self", "reason": "Found a partner",
                                       "email": "selfdeleted@example.com", "phone": "7700900123"}},
    ))
    await db.execute(update(User).where(User.id == deactivated.id).values(
        account_settings={"deactivation": {"at": (now - timedelta(days=2)).isoformat(), "by": "self", "reason": "Taking a break"}},
    ))
    for u in (self_deleted, admin_deleted, stranger):
        await db.execute(update(UserProfile).where(UserProfile.user_id == u.id).values(deleted_at=now))
    await db.flush()
    return t, {"live": live, "suspended": suspended, "self_deleted": self_deleted,
               "admin_deleted": admin_deleted, "deactivated": deactivated, "stranger": stranger}


async def test_data_requests_lists_member_and_staff_removals_only(client, db):
    _, m = await _requests(db)
    as_admin()
    r = await client.get(f"{A}/data-requests", headers=HEADERS)
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    by_id = {i["id"]: i for i in d["items"]}
    assert set(by_id) == {str(m["self_deleted"].id), str(m["admin_deleted"].id), str(m["deactivated"].id)}
    assert d["counts"] == {"deleted_by_member": 1, "deleted_by_admin": 1, "deactivated_by_member": 1}
    assert d["erasure_overdue"] == 1 and d["hard_erase_available"] is False

    sd = by_id[str(m["self_deleted"].id)]
    assert sd["kind"] == "deleted_by_member" and sd["reason"] == "Found a partner" and sd["days_since"] == 45
    assert sd["restorable"] is False and sd["erasure_overdue"] is True
    assert sd["email"] == "se***@example.com" and sd["contact_masked"] is True  # tombstone is masked in the list
    assert "selfdeleted@example.com" not in r.text and "7700900123" not in r.text

    assert by_id[str(m["admin_deleted"].id)]["restorable"] is True
    assert by_id[str(m["deactivated"].id)]["reason"] == "Taking a break"

    only = (await client.get(f"{A}/data-requests?kind=deactivated_by_member", headers=HEADERS)).json()["data"]
    assert [i["id"] for i in only["items"]] == [str(m["deactivated"].id)] and only["counts"]["deleted_by_member"] == 1
    assert (await client.get(f"{A}/data-requests?q=staff", headers=HEADERS)).json()["data"]["total"] == 1
    assert (await client.get(f"{A}/data-requests?kind=bogus", headers=HEADERS)).status_code == 400


async def test_restore_staff_deleted_account_requires_reason_and_is_audited(client, db):
    _, m = await _requests(db)
    as_admin()
    u = m["admin_deleted"]
    assert (await client.post(f"{A}/data-requests/{u.id}/restore", json={}, headers=HEADERS)).status_code == 422
    assert (await client.post(f"{A}/data-requests/{u.id}/restore", json={"reason": "no"}, headers=HEADERS)).status_code == 422

    r = await client.post(f"{A}/data-requests/{u.id}/restore", json={"reason": "Deleted by mistake"}, headers=HEADERS)
    assert r.status_code == 200, r.text
    await db.refresh(u)
    p = (await db.execute(select(UserProfile).where(UserProfile.user_id == u.id))).scalar_one()
    await db.refresh(p)
    assert u.deleted_at is None and u.is_active is True and p.deleted_at is None
    rows = [a for a in await _audit(db, "user.restore") if a.target_id == str(u.id)]
    assert len(rows) == 1 and rows[0].summary == "Deleted by mistake"

    again = await client.post(f"{A}/data-requests/{u.id}/restore", json={"reason": "Deleted by mistake"}, headers=HEADERS)
    assert again.status_code == 409


async def test_restore_refuses_self_deleted_suspended_and_foreign_accounts(client, db):
    _, m = await _requests(db)
    as_admin()
    body = {"reason": "They changed their mind"}

    r = await client.post(f"{A}/data-requests/{m['self_deleted'].id}/restore", json=body, headers=HEADERS)
    assert r.status_code == 409 and "register again" in r.text
    await db.refresh(m["self_deleted"])
    assert m["self_deleted"].deleted_at is not None and m["self_deleted"].email is None

    assert (await client.post(f"{A}/data-requests/{m['suspended'].id}/restore", json=body, headers=HEADERS)).status_code == 409
    await db.refresh(m["suspended"])
    assert m["suspended"].is_active is False  # a staff suspension is not undone from here

    assert (await client.post(f"{A}/data-requests/{m['live'].id}/restore", json=body, headers=HEADERS)).status_code == 409
    assert (await client.post(f"{A}/data-requests/{m['stranger'].id}/restore", json=body, headers=HEADERS)).status_code == 404
    await db.refresh(m["stranger"])
    assert m["stranger"].deleted_at is not None


async def test_legacy_restore_endpoint_also_refuses_self_deleted_accounts(client, db):
    _, m = await _requests(db)
    as_admin()
    r = await client.post(f"{A}/users/{m['self_deleted'].id}/restore", headers=HEADERS)
    assert r.status_code == 409, r.text
    await db.refresh(m["self_deleted"])
    assert m["self_deleted"].deleted_at is not None
    r = await client.post(f"{A}/users/{m['admin_deleted'].id}/restore", headers=HEADERS)
    assert r.status_code == 200, r.text  # staff soft-deletes still restore as before


async def test_restore_self_deactivated_account_clears_the_marker(client, db):
    _, m = await _requests(db)
    as_admin()
    u = m["deactivated"]
    r = await client.post(f"{A}/data-requests/{u.id}/restore", json={"reason": "Asked us by phone to reactivate"}, headers=HEADERS)
    assert r.status_code == 200, r.text
    await db.refresh(u)
    stored = (await db.execute(select(User.account_settings).where(User.id == u.id))).scalar_one()
    assert u.is_active is True and "deactivation" not in stored and stored["reactivated_by"] == "admin"
    assert any(a.target_id == str(u.id) for a in await _audit(db, "user.activate"))


async def test_admin_export_matches_member_export_and_is_audited(client, db):
    t, m = await _requests(db)
    u = m["self_deleted"]
    await consent(db, t, u, "terms_privacy")
    as_admin()

    r = await client.get(f"{A}/data-requests/{u.id}/export", headers=HEADERS)
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["export_format"] == "match4marriage.personal-data.v1" and d["generated_by"] == "admin"
    assert d["account"]["id"] == str(u.id) and d["profile"]["first_name"] == "Self"
    assert d["account_status"]["state"] == "deleted_by_member" and d["account_status"]["email_at_deletion"] == "selfdeleted@example.com"
    assert len(d["consents"]) == 1 and d["consents"][0]["consent_type"] == "terms_privacy"
    for never_exported in ("firebase_uids", "aadhaar_hash", "account_settings"):
        assert never_exported not in d["account"]

    rows = await _audit(db, "gdpr.export")
    assert len(rows) == 1 and rows[0].target_id == str(u.id) and rows[0].details["account_state"] == "deleted_by_member"

    assert (await client.get(f"{A}/data-requests/{m['stranger'].id}/export", headers=HEADERS)).status_code == 404
    assert len(await _audit(db, "gdpr.export")) == 1

    # The member's own export goes through the same builder (and now carries consents).
    live = m["live"]
    await consent(db, t, live, "marketing_email")
    as_member(live)
    mine = (await client.get("/api/v1/auth/me/export", headers=HEADERS)).json()["data"]
    assert mine["account"]["id"] == str(live.id) and [c["consent_type"] for c in mine["consents"]] == ["marketing_email"]
    assert set(mine) == set(d) - {"generated_by", "account_status"}


# ── Integrations health ─────────────────────────────────────────────────────

SECRETS = {
    "RESEND_API_KEY": "re_SECRETSECRETSECRET_1",
    "CLOUDINARY_API_SECRET": "cld-SECRETSECRETSECRET-2",
    "CLOUDINARY_API_KEY": "998877665544332",
    "CLOUDINARY_CLOUD_NAME": "m4m-secret-cloud",
    "FIREBASE_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----SECRETSECRET3-----END PRIVATE KEY-----",
    "FIREBASE_CLIENT_EMAIL": "firebase-adminsdk-abc12@m4m-prod.iam.gserviceaccount.com",
    "FIREBASE_PROJECT_ID": "m4m-prod-project",
    "DATABASE_URL": "postgresql://dbuser:DBPASSWORDSECRET4@ep-quiet-forest-12345.eu-west-2.aws.neon.tech/neondb",
    "REDIS_URL": "rediss://default:REDISPASSWORDSECRET5@fly-m4m-redis.upstash.io:6379",
}
PAYPAL_SECRET = "PAYPALSECRETSECRET6"
PAYPAL_CLIENT = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789CLIENTID"
SENTRY_DSN = "https://publickeySECRET7@o123456.ingest.sentry.io/4507777"


def _configure(monkeypatch):
    from app.routers import admin_compliance as ac
    for k, v in SECRETS.items():
        monkeypatch.setattr(ac.settings, k, v)
    monkeypatch.setenv("SENTRY_DSN", SENTRY_DSN)


async def _paypal_row(db, t, **kw):
    from app.models.payment_gateway_config import PaymentGatewayConfig, PaymentGatewayName
    db.add(PaymentGatewayConfig(id=uuid.uuid4(), tenant_id=t.id, gateway=PaymentGatewayName.PAYPAL,
                                publishable_key=PAYPAL_CLIENT, secret_key=PAYPAL_SECRET, webhook_secret="WH-SECRET-8-ID",
                                **{"is_test_mode": False, "is_active": True, **kw}))
    await db.flush()


def _assert_no_secrets(text: str) -> None:
    leaked = [k for k, v in SECRETS.items() if v in text and k not in ("CLOUDINARY_UPLOAD_FOLDER",)]
    assert leaked == [], f"leaked: {leaked}"
    for frag in ("SECRET", PAYPAL_CLIENT, "DBPASSWORD", "REDISPASSWORD", "dbuser", "ep-quiet-forest-12345",
                 "m4m-secret-cloud", "m4m-prod-project", "firebase-adminsdk-abc12", "998877665544332", "o123456.ingest"):
        assert frag not in text, f"leaked fragment: {frag}"


async def test_integrations_config_view_never_calls_out_or_returns_secrets(client, db, monkeypatch):
    t = await tenant(db)
    await _paypal_row(db, t)
    _configure(monkeypatch)
    from app.core import firebase as firebase_core
    monkeypatch.setattr(firebase_core, "get_firebase_app", lambda: object())
    as_admin()

    r = await client.get(f"{A}/integrations", headers=HEADERS)  # probes are stubbed to explode if called
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    svc = {s["key"]: s for s in d["services"]}
    assert list(svc) == ["database", "redis", "firebase", "resend", "cloudinary", "paypal", "sentry"]
    assert d["live"] is False and all(s["configured"] for s in svc.values())
    for key in ("firebase", "resend", "cloudinary", "paypal"):
        assert svc[key]["status"] == "unchecked" and svc[key]["live_checked"] is False

    # Redis: reachable, but it is the in-memory stand-in — that must be called out.
    assert svc["redis"]["live_checked"] is True and svc["redis"]["status"] in ("warning", "error")
    assert "fakeredis" in svc["redis"]["identifiers"]["mode"] and "REDIS_URL" in svc["redis"]["action"]
    assert svc["database"]["live_checked"] is True and svc["database"]["status"] == "ok"

    # Masked identifiers are present and useful, raw values are not.
    assert svc["paypal"]["identifiers"] == {"client_id": "…" + PAYPAL_CLIENT[-4:], "client_secret_set": True,
                                            "webhook_id_set": True, "mode": "live", "enabled": True}
    assert svc["cloudinary"]["identifiers"]["api_key"] == "…4332" and svc["cloudinary"]["identifiers"]["api_secret_set"] is True
    assert svc["firebase"]["identifiers"]["private_key_set"] is True
    assert svc["database"]["identifiers"]["provider"] == "Neon"
    _assert_no_secrets(r.text)


async def test_integrations_live_checks_report_each_provider(client, db, monkeypatch):
    from app.core import firebase as firebase_core
    from app.routers import admin_compliance as ac

    t = await tenant(db)
    await _paypal_row(db, t, is_test_mode=True)
    _configure(monkeypatch)
    monkeypatch.setattr(firebase_core, "get_firebase_app", lambda: object())
    calls: list[str] = []

    def http_get(url, *, headers=None, auth=None):
        calls.append(url)
        if "resend.com" in url:
            assert headers == {"Authorization": f"Bearer {SECRETS['RESEND_API_KEY']}"}
            return 200, {"data": [{"name": "match4marriage.com", "status": "pending"}]}
        assert auth == (SECRETS["CLOUDINARY_API_KEY"], SECRETS["CLOUDINARY_API_SECRET"])
        return 401, {"error": {"message": f"bad credentials for {SECRETS['CLOUDINARY_API_SECRET']}"}}

    def paypal(cfg):
        calls.append("paypal")
        raise RuntimeError(f"401 for client {cfg.client_id} secret {cfg.client_secret}")

    monkeypatch.setattr(ac, "_http_get", http_get)
    monkeypatch.setattr(ac, "_probe_firebase", lambda app_: calls.append("firebase") or "ok")
    monkeypatch.setattr(ac, "_probe_paypal", paypal)
    as_admin()

    r = await client.get(f"{A}/integrations?live=true", headers=HEADERS)
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    svc = {s["key"]: s for s in d["services"]}
    assert sorted(calls) == sorted(["https://api.resend.com/domains", "https://api.cloudinary.com/v1_1/m4m-secret-cloud/ping", "paypal", "firebase"])
    assert svc["firebase"]["status"] == "ok"
    assert svc["resend"]["status"] == "warning" and "not verified" in svc["resend"]["detail"]
    assert svc["cloudinary"]["status"] == "error"
    assert svc["paypal"]["status"] == "error" and svc["paypal"]["live_checked"] is True
    assert d["overall"] == "error" and d["live"] is True
    _assert_no_secrets(r.text)  # provider error bodies / exceptions are never echoed


async def test_integrations_reports_what_is_not_configured(client, db, monkeypatch):
    from app.routers import admin_compliance as ac
    await tenant(db)
    for k in ("RESEND_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_API_KEY", "CLOUDINARY_CLOUD_NAME",
              "FIREBASE_PRIVATE_KEY", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PROJECT_ID"):
        monkeypatch.setattr(ac.settings, k, "")
    monkeypatch.setattr(ac.settings, "REDIS_URL", "redis://localhost:6379")
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    as_admin()

    r = await client.get(f"{A}/integrations?live=true", headers=HEADERS)  # nothing configured → nothing to probe
    assert r.status_code == 200, r.text
    svc = {s["key"]: s for s in r.json()["data"]["services"]}
    for key in ("firebase", "resend", "cloudinary", "paypal", "sentry", "redis"):
        assert svc[key]["configured"] is False and svc[key]["action"], key
    assert svc["firebase"]["status"] == "error" and svc["paypal"]["status"] == "warning"
