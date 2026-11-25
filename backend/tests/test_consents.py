"""
UK GDPR consent records + server-side 18+ rule.

Covers:
- GET /consents/me reports needs_consent until terms + sensitive-data consent
  are recorded at the current policy version
- POST /consents appends rows and syncs the marketing preference
- PATCH /profile/me rejects an under-18 DOB only when the DOB is set/changed
"""
import uuid
from datetime import date

import pytest
from sqlalchemy import select

from app.core.security import get_current_user
from app.main import app
from app.models.consent import UserConsent
from app.models.tenant import Tenant
from app.models.user import User, UserProfile
from app.routers.consents import POLICY_VERSION

HEADERS = {"X-Tenant-ID": "match4marriage"}


async def _seed(db, *, dob: date | None = None) -> User:
    tenant = (await db.execute(select(Tenant).where(Tenant.slug == "match4marriage"))).scalar_one_or_none()
    if tenant is None:
        tenant = Tenant(id=uuid.uuid4(), slug="match4marriage", name="Match4Marriage")
        db.add(tenant)
        await db.flush()
    user = User(id=uuid.uuid4(), tenant_id=tenant.id, email=f"{uuid.uuid4().hex[:8]}@example.com", firebase_uids=[])
    db.add(user)
    await db.flush()
    if dob is not None:
        db.add(UserProfile(id=uuid.uuid4(), tenant_id=tenant.id, user_id=user.id, first_name="Test", last_name="Member", date_of_birth=dob))
        await db.flush()
    app.dependency_overrides[get_current_user] = lambda: {"sub": str(user.id), "email": user.email}
    return user


def _years_ago(n: int) -> date:
    t = date.today()
    try:
        return t.replace(year=t.year - n)
    except ValueError:  # 29 Feb
        return t.replace(year=t.year - n, day=28)


@pytest.mark.asyncio
async def test_new_member_needs_consent_then_is_up_to_date(client, db):
    await _seed(db)

    r = await client.get("/api/v1/consents/me", headers=HEADERS)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["needs_consent"] is True

    r = await client.post(
        "/api/v1/consents",
        json={"consents": {"terms_privacy": True, "sensitive_data": True, "marketing_email": False}, "source": "signup"},
        headers=HEADERS,
    )
    assert r.status_code == 200, r.text

    r = await client.get("/api/v1/consents/me", headers=HEADERS)
    data = r.json()["data"]
    assert data["needs_consent"] is False
    assert data["consents"]["terms_privacy"]["policy_version"] == POLICY_VERSION
    assert data["consents"]["marketing_email"]["granted"] is False


@pytest.mark.asyncio
async def test_consent_rows_are_append_only_and_recorded_with_source(client, db):
    user = await _seed(db)
    for granted in (True, False):
        r = await client.post(
            "/api/v1/consents",
            json={"consents": {"marketing_email": granted}, "source": "settings"},
            headers=HEADERS,
        )
        assert r.status_code == 200, r.text

    rows = (await db.execute(
        select(UserConsent).where(UserConsent.user_id == user.id).order_by(UserConsent.created_at)
    )).scalars().all()
    assert [r.granted for r in rows] == [True, False]
    assert all(r.source == "settings" and r.policy_version == POLICY_VERSION for r in rows)


@pytest.mark.asyncio
async def test_only_marketing_consent_still_needs_required_ones(client, db):
    await _seed(db)
    await client.post("/api/v1/consents", json={"consents": {"marketing_email": True}}, headers=HEADERS)
    r = await client.get("/api/v1/consents/me", headers=HEADERS)
    assert r.json()["data"]["needs_consent"] is True


@pytest.mark.asyncio
async def test_unknown_consent_type_rejected(client, db):
    await _seed(db)
    r = await client.post("/api/v1/consents", json={"consents": {"sell_my_data": True}}, headers=HEADERS)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_under_18_dob_rejected_when_set(client, db):
    await _seed(db, dob=_years_ago(30))
    r = await client.patch("/api/v1/profile/me", json={"date_of_birth": _years_ago(16).isoformat()}, headers=HEADERS)
    assert r.status_code == 422, r.text
    assert "18" in r.text


@pytest.mark.asyncio
async def test_unchanged_dob_never_blocks_existing_member(client, db):
    # Even a (legacy/bad) under-18 DOB already on file must not block an
    # unrelated profile save that re-sends the same DOB.
    legacy = _years_ago(17)
    await _seed(db, dob=legacy)
    r = await client.patch(
        "/api/v1/profile/me",
        json={"date_of_birth": legacy.isoformat(), "occupation": "Engineer"},
        headers=HEADERS,
    )
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_adult_dob_accepted(client, db):
    await _seed(db, dob=_years_ago(30))
    r = await client.patch("/api/v1/profile/me", json={"date_of_birth": _years_ago(25).isoformat()}, headers=HEADERS)
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_settings_marketing_toggle_is_logged_as_consent(client, db):
    user = await _seed(db)
    r = await client.patch(
        "/api/v1/auth/me/settings",
        json={"notifications": {"email_marketing": True}},
        headers=HEADERS,
    )
    assert r.status_code == 200, r.text
    rows = (await db.execute(
        select(UserConsent).where(UserConsent.user_id == user.id, UserConsent.consent_type == "marketing_email")
    )).scalars().all()
    assert len(rows) == 1 and rows[0].granted is True and rows[0].source == "settings"
