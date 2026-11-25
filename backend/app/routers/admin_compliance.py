"""
Admin compliance + operations console.

  Consent register (UK GDPR Art. 7(1) — "be able to demonstrate consent")
    GET  /admin/consents/summary            headline numbers for the current policy version
    GET  /admin/consents                    the append-only consent log (filterable, CSV)
    GET  /admin/consents/members            each member's CURRENT consent state (filterable, CSV)
    GET  /admin/consents/member/{id}        one member's full consent history

  Data requests (accounts members have deactivated or deleted)
    GET  /admin/data-requests               list + counts
    GET  /admin/data-requests/{id}/export   that member's personal data (same file as /auth/me/export)
    POST /admin/data-requests/{id}/restore  undo an admin soft-delete / a self-deactivation

  Integrations health
    GET  /admin/integrations                configured? + optional live checks (never returns secrets)

Every route requires the admin role (router-level dependency AND a per-route
check) and every query is tenant-scoped.

NOTE: no `from __future__ import annotations` here — this module uses the
slowapi `@limiter.limit` decorator and that import breaks FastAPI's parameter
resolution for decorated routes.
"""
import asyncio
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import and_, func, or_, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.core.security import get_current_user, has_admin_role, require_admin
from app.core.tenancy import get_current_tenant_slug
from app.models.consent import UserConsent
from app.models.user import User, UserProfile
from app.routers.consents import CONSENT_TYPES, POLICY_VERSION, REQUIRED_TYPES
from app.schemas.common import APIResponse, PaginatedResponse
from app.services.audit import record_admin_action

settings = get_settings()
logger = get_logger(__name__)

router = APIRouter(
    prefix="/admin",
    tags=["admin-compliance"],
    # Belt and braces: every route below also calls _require_admin().
    dependencies=[Depends(require_admin)],
)

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[dict, Depends(get_current_user)]


# ─── Shared helpers ──────────────────────────────────────────────────────────


def _require_admin(current_user: dict) -> None:
    if not has_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin required")


async def _tenant(db: AsyncSession, tenant_slug: str) -> uuid.UUID:
    from app.routers.profile import _resolve_tenant_uuid
    t = await _resolve_tenant_uuid(db, tenant_slug)
    if t is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return t


def _iso(v: Any) -> str | None:
    return v.isoformat() if v is not None and hasattr(v, "isoformat") else None


def _full_name(first: str | None, last: str | None) -> str | None:
    n = f"{(first or '').strip()} {(last or '').strip()}".strip()
    return n or None


def _csv_safe_row(d: dict[str, Any], cols: list[str]) -> list[str]:
    """CSV cells for the consent exports. These carry member-controlled text
    (names, and the browser's User-Agent header), so neutralise anything a
    spreadsheet would run as a formula (=, +, -, @, tab, CR) by prefixing a
    single quote — otherwise a member could plant a formula in staff's export."""
    from app.routers.admin import _csv_row
    out = []
    for cell in _csv_row(d, cols):
        out.append("'" + cell if cell[:1] in ("=", "+", "-", "@", "\t", "\r") else cell)
    return out


class ReasonIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason")
    @classmethod
    def _reason(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 5:
            raise ValueError("Give a reason of at least 5 characters — it goes in the audit log.")
        return v


# ═════════════════════════════════════════════════════════════════════════════
# Consent register
# ═════════════════════════════════════════════════════════════════════════════

CONSENT_LABELS = {
    "terms_privacy": "Terms & Privacy Policy",
    "sensitive_data": "Sensitive data (religion, community, horoscope)",
    "marketing_email": "Marketing emails",
}
# Hard ceiling on the in-memory "current state per member" roll-up. A bureau is
# thousands of members, not millions; past this the summary says so.
_MEMBER_ROLLUP_CAP = 50_000


def _ser_consent(c: UserConsent) -> dict[str, Any]:
    return {
        "id": str(c.id),
        "created_at": _iso(c.created_at),
        "consent_type": c.consent_type,
        "consent_label": CONSENT_LABELS.get(c.consent_type, c.consent_type),
        "granted": bool(c.granted),
        "policy_version": c.policy_version,
        "is_current_version": c.policy_version == POLICY_VERSION,
        "source": c.source,
        "ip_address": c.ip_address,
        "user_agent": c.user_agent,
    }


def _member_status(latest: dict[str, UserConsent]) -> str:
    """confirmed  — every required consent granted at the CURRENT policy version
       outdated   — every required consent granted, but at an older version
       incomplete — some required consent missing or withdrawn
       never      — no required consent on record at all"""
    req = [latest.get(t) for t in REQUIRED_TYPES]
    if all(r is None for r in req):
        return "never"
    if all(r is not None and r.granted for r in req):
        return "confirmed" if all(r.policy_version == POLICY_VERSION for r in req) else "outdated"  # type: ignore[union-attr]
    return "incomplete"


async def _latest_consents(db: AsyncSession, tenant_uuid: uuid.UUID, user_id: uuid.UUID | None = None) -> dict[uuid.UUID, dict[str, UserConsent]]:
    """{user_id: {consent_type: latest row}} — the member's current state is the
    newest row per (user, type); rows are append-only."""
    cond = [UserConsent.tenant_id == tenant_uuid, UserConsent.deleted_at.is_(None)]
    if user_id is not None:
        cond.append(UserConsent.user_id == user_id)
    newest = (
        select(UserConsent.user_id.label("uid"), UserConsent.consent_type.label("ct"),
               func.max(UserConsent.created_at).label("mx"))
        .where(*cond).group_by(UserConsent.user_id, UserConsent.consent_type).subquery()
    )
    rows = (await db.execute(
        select(UserConsent)
        .join(newest, and_(
            UserConsent.user_id == newest.c.uid,
            UserConsent.consent_type == newest.c.ct,
            UserConsent.created_at == newest.c.mx,
        ))
        .where(*cond)
        .order_by(UserConsent.created_at.asc(), UserConsent.id.asc())
    )).scalars().all()
    out: dict[uuid.UUID, dict[str, UserConsent]] = {}
    for r in rows:
        out.setdefault(r.user_id, {})[r.consent_type] = r
    return out


async def _member_rows(db: AsyncSession, tenant_uuid: uuid.UUID, q: str | None = None) -> list[Any]:
    """Non-deleted accounts in the tenant (the population consent is measured over)."""
    stmt = (
        select(User.id, User.email, User.membership_number, User.created_at, User.is_active,
               UserProfile.first_name, UserProfile.last_name)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.tenant_id == tenant_uuid, User.deleted_at.is_(None))
    )
    if q and q.strip():
        ql = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(
            func.lower(func.coalesce(User.email, "")).like(ql),
            func.upper(func.coalesce(User.membership_number, "")).like(f"%{q.strip().upper()}%"),
            func.lower(func.coalesce(UserProfile.first_name, "")).like(ql),
            func.lower(func.coalesce(UserProfile.last_name, "")).like(ql),
        ))
    return list((await db.execute(stmt.order_by(User.created_at.desc()).limit(_MEMBER_ROLLUP_CAP))).all())


def _member_consent_row(m: Any, latest: dict[str, UserConsent]) -> dict[str, Any]:
    def _cell(t: str) -> dict[str, Any] | None:
        r = latest.get(t)
        if r is None:
            return None
        return {"granted": bool(r.granted), "policy_version": r.policy_version, "at": _iso(r.created_at), "source": r.source}

    dates = [r.created_at for r in latest.values() if r.created_at is not None]
    mk = latest.get("marketing_email")
    return {
        "id": str(m.id),
        "name": _full_name(m.first_name, m.last_name) or m.membership_number or m.email or "(unnamed)",
        "email": m.email,
        "membership_number": m.membership_number,
        "is_active": bool(m.is_active),
        "joined_at": _iso(m.created_at),
        "status": _member_status(latest),
        "terms_privacy": _cell("terms_privacy"),
        "sensitive_data": _cell("sensitive_data"),
        "marketing_email": _cell("marketing_email"),
        "marketing_opt_in": bool(mk and mk.granted),
        "last_consent_at": _iso(max(dates)) if dates else None,
    }


@router.get("/consents/summary", response_model=APIResponse[dict])
async def consents_summary(
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    members = await _member_rows(db, tenant_uuid)
    latest = await _latest_consents(db, tenant_uuid)

    counts = {"confirmed": 0, "outdated": 0, "incomplete": 0, "never": 0}
    marketing_in = marketing_out = 0
    by_type = {t: {"granted": 0, "withdrawn": 0, "none": 0, "granted_current_version": 0} for t in CONSENT_TYPES}
    for m in members:
        state = latest.get(m.id, {})
        counts[_member_status(state)] += 1
        mk = state.get("marketing_email")
        if mk is not None and mk.granted:
            marketing_in += 1
        elif mk is not None:
            marketing_out += 1
        for t in CONSENT_TYPES:
            r = state.get(t)
            if r is None:
                by_type[t]["none"] += 1
            elif r.granted:
                by_type[t]["granted"] += 1
                if r.policy_version == POLICY_VERSION:
                    by_type[t]["granted_current_version"] += 1
            else:
                by_type[t]["withdrawn"] += 1

    total = len(members)
    events_total, last_event = (await db.execute(
        select(func.count(), func.max(UserConsent.created_at)).where(
            UserConsent.tenant_id == tenant_uuid, UserConsent.deleted_at.is_(None))
    )).one()
    events_30d = (await db.execute(
        select(func.count()).select_from(UserConsent).where(
            UserConsent.tenant_id == tenant_uuid, UserConsent.deleted_at.is_(None),
            UserConsent.created_at >= datetime.now(timezone.utc) - timedelta(days=30))
    )).scalar_one()
    versions = (await db.execute(
        select(UserConsent.policy_version, func.count()).where(
            UserConsent.tenant_id == tenant_uuid, UserConsent.deleted_at.is_(None),
        ).group_by(UserConsent.policy_version).order_by(UserConsent.policy_version.desc())
    )).all()

    def _rate(n: int) -> float:
        return round(100.0 * n / total, 1) if total else 0.0

    return APIResponse(success=True, data={
        "policy_version": POLICY_VERSION,
        "required_types": list(REQUIRED_TYPES),
        "labels": CONSENT_LABELS,
        "members_total": total,
        "members_capped": total >= _MEMBER_ROLLUP_CAP,
        "confirmed_current": counts["confirmed"],
        "confirmed_rate": _rate(counts["confirmed"]),
        "not_confirmed": total - counts["confirmed"],
        "outdated_version": counts["outdated"],
        "incomplete": counts["incomplete"],
        "never_recorded": counts["never"],
        "marketing_opt_in": marketing_in,
        "marketing_opt_out": marketing_out,
        "marketing_no_answer": total - marketing_in - marketing_out,
        "marketing_opt_in_rate": _rate(marketing_in),
        "by_type": by_type,
        "events_total": int(events_total or 0),
        "events_30d": int(events_30d or 0),
        "last_event_at": _iso(last_event),
        "versions": [{"policy_version": v, "events": int(n)} for v, n in versions],
        "sources": ["signup", "reconsent_prompt", "settings"],
    })


CONSENT_EVENT_CSV_COLS = [
    "created_at", "member_name", "member_email", "membership_number", "user_id",
    "consent_type", "granted", "policy_version", "source", "ip_address", "user_agent", "id",
]
CONSENT_MEMBER_CSV_COLS = [
    "name", "email", "membership_number", "id", "status",
    "terms_privacy_granted", "terms_privacy_version", "terms_privacy_at",
    "sensitive_data_granted", "sensitive_data_version", "sensitive_data_at",
    "marketing_email_granted", "marketing_email_at", "last_consent_at", "joined_at",
]


@router.get("/consents", response_model=PaginatedResponse[dict])
async def list_consent_events(
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
    consent_type: str | None = Query(default=None),
    granted: bool | None = Query(default=None),
    version: str | None = Query(default=None, description="'current', 'older' or an exact policy version"),
    source: str | None = Query(default=None),
    user_id: uuid.UUID | None = Query(default=None),
    q: str | None = Query(default=None, max_length=120),
    days: int | None = Query(default=None, ge=1, le=3650),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    format: str | None = Query(default=None, description="json (default) | csv"),
):
    """The append-only consent log: one row per decision, newest first."""
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    if consent_type and consent_type not in CONSENT_TYPES:
        raise HTTPException(status_code=400, detail=f"consent_type must be one of {', '.join(CONSENT_TYPES)}")

    base = (
        select(UserConsent, User, UserProfile)
        .outerjoin(User, and_(User.id == UserConsent.user_id, User.tenant_id == tenant_uuid))
        .outerjoin(UserProfile, UserProfile.user_id == UserConsent.user_id)
        .where(UserConsent.tenant_id == tenant_uuid, UserConsent.deleted_at.is_(None))
    )
    if consent_type:
        base = base.where(UserConsent.consent_type == consent_type)
    if granted is not None:
        base = base.where(UserConsent.granted.is_(granted))
    if version == "current":
        base = base.where(UserConsent.policy_version == POLICY_VERSION)
    elif version == "older":
        base = base.where(UserConsent.policy_version != POLICY_VERSION)
    elif version:
        base = base.where(UserConsent.policy_version == version.strip()[:20])
    if source:
        base = base.where(UserConsent.source == source.strip()[:40])
    if user_id is not None:
        base = base.where(UserConsent.user_id == user_id)
    if days:
        base = base.where(UserConsent.created_at >= datetime.now(timezone.utc) - timedelta(days=days))
    if q and q.strip():
        ql = f"%{q.strip().lower()}%"
        base = base.where(or_(
            func.lower(func.coalesce(User.email, "")).like(ql),
            func.upper(func.coalesce(User.membership_number, "")).like(f"%{q.strip().upper()}%"),
            func.lower(func.coalesce(UserProfile.first_name, "")).like(ql),
            func.lower(func.coalesce(UserProfile.last_name, "")).like(ql),
        ))

    def _item(c: UserConsent, u: User | None, p: UserProfile | None) -> dict[str, Any]:
        return {
            **_ser_consent(c),
            "user_id": str(c.user_id),
            "member_name": (_full_name(p.first_name, p.last_name) if p else None) or (u.membership_number if u else None) or (u.email if u else None) or "(unknown)",
            "member_email": u.email if u else None,
            "membership_number": u.membership_number if u else None,
            "member_deleted": bool(u is None or u.deleted_at is not None),
        }

    order = (UserConsent.created_at.desc(), UserConsent.id.desc())

    if (format or "").lower() == "csv":
        from app.routers.admin import _stream_csv
        rows = (await db.execute(base.order_by(*order).limit(50_000))).all()
        await record_admin_action(
            db, current_user, "access.export_consents", tenant_id=tenant_uuid,
            target_type="export", target_label="consent-log.csv",
            details={"rows": len(rows), "view": "events", "consent_type": consent_type, "version": version, "source": source, "q": q, "days": days},
        )
        return _stream_csv(
            filename="consent-log.csv",
            cols=CONSENT_EVENT_CSV_COLS,
            row_iter=(_csv_safe_row(_item(c, u, p), CONSENT_EVENT_CSV_COLS) for c, u, p in rows),
        )

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(base.order_by(*order).offset((page - 1) * limit).limit(limit))).all()
    return PaginatedResponse.create(items=[_item(c, u, p) for c, u, p in rows], total=total, page=page, limit=limit)


@router.get("/consents/members", response_model=PaginatedResponse[dict])
async def list_member_consents(
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
    status: str | None = Query(default=None, description="confirmed | not_confirmed | outdated | incomplete | never"),
    marketing: str | None = Query(default=None, description="in | out | none"),
    q: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    format: str | None = Query(default=None, description="json (default) | csv"),
):
    """Each member's CURRENT consent state — who still needs to confirm the
    current policy version, who has opted in to marketing."""
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    allowed = {"confirmed", "not_confirmed", "outdated", "incomplete", "never"}
    if status and status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {', '.join(sorted(allowed))}")
    if marketing and marketing not in {"in", "out", "none"}:
        raise HTTPException(status_code=400, detail="marketing must be one of in, out, none")

    members = await _member_rows(db, tenant_uuid, q)
    latest = await _latest_consents(db, tenant_uuid)
    items = [_member_consent_row(m, latest.get(m.id, {})) for m in members]
    if status == "not_confirmed":
        items = [i for i in items if i["status"] != "confirmed"]
    elif status:
        items = [i for i in items if i["status"] == status]
    if marketing == "in":
        items = [i for i in items if i["marketing_opt_in"]]
    elif marketing == "out":
        items = [i for i in items if i["marketing_email"] is not None and not i["marketing_opt_in"]]
    elif marketing == "none":
        items = [i for i in items if i["marketing_email"] is None]

    if (format or "").lower() == "csv":
        from app.routers.admin import _stream_csv

        def _flat(i: dict[str, Any]) -> dict[str, Any]:
            out = dict(i)
            for t in CONSENT_TYPES:
                cell = i.get(t) or {}
                out[f"{t}_granted"] = cell.get("granted") if cell else None
                out[f"{t}_version"] = cell.get("policy_version")
                out[f"{t}_at"] = cell.get("at")
            return out

        await record_admin_action(
            db, current_user, "access.export_consents", tenant_id=tenant_uuid,
            target_type="export", target_label="consent-status.csv",
            details={"rows": len(items), "view": "members", "status": status, "marketing": marketing, "q": q},
        )
        return _stream_csv(
            filename="consent-status.csv",
            cols=CONSENT_MEMBER_CSV_COLS,
            row_iter=(_csv_safe_row(_flat(i), CONSENT_MEMBER_CSV_COLS) for i in items),
        )

    total = len(items)
    start = (page - 1) * limit
    return PaginatedResponse.create(items=items[start:start + limit], total=total, page=page, limit=limit)


@router.get("/consents/member/{user_id}", response_model=APIResponse[dict])
async def member_consent_history(
    user_id: uuid.UUID,
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """One member's full, append-only consent history plus their current state."""
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    exists = (await db.execute(
        select(User.id).where(User.id == user_id, User.tenant_id == tenant_uuid)
    )).scalar_one_or_none()
    if exists is None:
        raise HTTPException(status_code=404, detail="User not found")

    rows = (await db.execute(
        select(UserConsent).where(
            UserConsent.tenant_id == tenant_uuid, UserConsent.user_id == user_id, UserConsent.deleted_at.is_(None),
        ).order_by(UserConsent.created_at.desc(), UserConsent.id.desc())
    )).scalars().all()
    latest = (await _latest_consents(db, tenant_uuid, user_id)).get(user_id, {})
    current = {}
    for t in CONSENT_TYPES:
        r = latest.get(t)
        current[t] = {
            "label": CONSENT_LABELS[t],
            "required": t in REQUIRED_TYPES,
            "granted": bool(r.granted) if r is not None else None,
            "policy_version": r.policy_version if r is not None else None,
            "is_current_version": bool(r is not None and r.policy_version == POLICY_VERSION),
            "at": _iso(r.created_at) if r is not None else None,
            "source": r.source if r is not None else None,
        }
    status_ = _member_status(latest)
    return APIResponse(success=True, data={
        "policy_version": POLICY_VERSION,
        "status": status_,
        "needs_consent": status_ != "confirmed",
        "current": current,
        "history": [_ser_consent(r) for r in rows],
    })


# ═════════════════════════════════════════════════════════════════════════════
# Data requests — deactivated / deleted accounts
# ═════════════════════════════════════════════════════════════════════════════

# UK GDPR Art. 12(3): respond to an erasure request within one month.
ERASURE_DEADLINE_DAYS = 30


def _parse_iso(v: Any) -> datetime | None:
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if not isinstance(v, str) or not v:
        return None
    try:
        d = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _classify(u_deleted_at: Any, is_active: bool, stored: dict[str, Any]) -> dict[str, Any] | None:
    """Turn the account flags + account_settings markers into one request row.
    Returns None for accounts that aren't a data request (active, or simply
    suspended by staff)."""
    deletion = stored.get("deletion") if isinstance(stored.get("deletion"), dict) else None
    deact = stored.get("deactivation") if isinstance(stored.get("deactivation"), dict) else None
    if u_deleted_at is not None:
        by_member = bool(deletion and (deletion.get("by") or "self") == "self")
        at = _parse_iso((deletion or {}).get("at")) or _parse_iso(u_deleted_at)
        if by_member:
            return {
                "kind": "deleted_by_member", "at": at, "reason": deletion.get("reason"),
                "restorable": False,
                "restore_blocker": (
                    "The member deleted this account themselves: their sign-in was removed and their email/phone were "
                    "detached from the record. It can't be restored from the console — they would need to register again."
                ),
                "tombstone": deletion,
            }
        return {
            "kind": "deleted_by_admin", "at": at, "reason": None,
            "restorable": True, "restore_blocker": None, "tombstone": None,
        }
    if not is_active and deact and (deact.get("by") or "") == "self":
        return {
            "kind": "deactivated_by_member", "at": _parse_iso(deact.get("at")), "reason": deact.get("reason"),
            "restorable": True, "restore_blocker": None, "tombstone": None,
        }
    return None


async def _settings_map(db: AsyncSession, tenant_uuid: uuid.UUID, ids: list[uuid.UUID]) -> dict[uuid.UUID, dict[str, Any]]:
    """account_settings is a deferred column that may not exist on a database
    the boot guard hasn't reached — read it in a SAVEPOINT and degrade to {}."""
    if not ids:
        return {}
    import json
    try:
        async with db.begin_nested():
            rows = (await db.execute(
                select(User.id, User.account_settings).where(User.tenant_id == tenant_uuid, User.id.in_(ids))
            )).all()
    except Exception as exc:
        logger.warning("data_requests_settings_read_failed", error=str(exc))
        return {}
    out: dict[uuid.UUID, dict[str, Any]] = {}
    for uid, val in rows:
        if isinstance(val, str):
            try:
                val = json.loads(val)
            except ValueError:
                val = None
        out[uid] = dict(val) if isinstance(val, dict) else {}
    return out


@router.get("/data-requests", response_model=APIResponse[dict])
async def list_data_requests(
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
    kind: str | None = Query(default=None, description="deleted_by_member | deleted_by_admin | deactivated_by_member"),
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=500, ge=1, le=2000),
):
    """Accounts members have deactivated or deleted (plus staff soft-deletes),
    newest first, with how long each erasure has been outstanding."""
    from app.routers.auth import _mask_email, _mask_phone

    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    kinds = {"deleted_by_member", "deleted_by_admin", "deactivated_by_member"}
    if kind and kind not in kinds:
        raise HTTPException(status_code=400, detail=f"kind must be one of {', '.join(sorted(kinds))}")

    rows = (await db.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.tenant_id == tenant_uuid, or_(User.deleted_at.is_not(None), User.is_active.is_(False)))
        .order_by(User.updated_at.desc())
        .limit(5000)
    )).all()
    stored_by_id = await _settings_map(db, tenant_uuid, [u.id for u, _ in rows])

    now = datetime.now(timezone.utc)
    items: list[dict[str, Any]] = []
    counts = {k: 0 for k in kinds}
    overdue = 0
    ql = (q or "").strip().lower()
    for u, p in rows:
        c = _classify(u.deleted_at, bool(u.is_active), stored_by_id.get(u.id, {}))
        if c is None:
            continue
        counts[c["kind"]] += 1
        at: datetime | None = c["at"]
        days = (now - at).days if at else None
        is_erasure = c["kind"] == "deleted_by_member"
        erasure_overdue = bool(is_erasure and days is not None and days > ERASURE_DEADLINE_DAYS)
        if erasure_overdue:
            overdue += 1
        if kind and c["kind"] != kind:
            continue
        tomb = c["tombstone"] or {}
        name = _full_name(p.first_name if p else None, p.last_name if p else None)
        item = {
            "id": str(u.id),
            "name": name or u.membership_number or "(unnamed)",
            "membership_number": u.membership_number,
            "kind": c["kind"],
            "at": _iso(at),
            "days_since": days,
            "reason": c["reason"],
            # A self-deleted account's contact details live in the tombstone;
            # show them masked — the export carries the full record.
            "email": u.email if u.email else _mask_email(tomb.get("email")),
            "phone": u.phone if u.phone else _mask_phone(tomb.get("phone")),
            "contact_masked": bool(not u.email and tomb.get("email")) or bool(not u.phone and tomb.get("phone")),
            "restorable": c["restorable"],
            "restore_blocker": c["restore_blocker"],
            "is_erasure_request": is_erasure,
            "erasure_overdue": erasure_overdue,
            "erasure_due_in_days": (ERASURE_DEADLINE_DAYS - days) if (is_erasure and days is not None) else None,
            "joined_at": _iso(u.created_at),
        }
        if ql and ql not in " ".join(str(x or "") for x in (item["name"], item["membership_number"], u.email, tomb.get("email"))).lower():
            continue
        items.append(item)

    items.sort(key=lambda i: i["at"] or "", reverse=True)
    return APIResponse(success=True, data={
        "items": items[:limit],
        "total": len(items),
        "counts": counts,
        "erasure_overdue": overdue,
        "erasure_deadline_days": ERASURE_DEADLINE_DAYS,
        "hard_erase_available": False,
    })


@router.get("/data-requests/{user_id}/export", response_model=APIResponse[dict])
@limiter.limit("30/hour")
async def export_member_data(
    request: Request,
    user_id: uuid.UUID,
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Subject-access export for one member — the same file the member gets
    from GET /auth/me/export, built by the same function. Works for deleted and
    deactivated accounts. Always audited (`gdpr.export`)."""
    from app.routers.auth import build_personal_data_export

    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    row = (await db.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.id == user_id, User.tenant_id == tenant_uuid)
    )).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    u, p = row

    export = await build_personal_data_export(db, u.id)
    if export is None:
        raise HTTPException(status_code=404, detail="No account data found.")

    stored = (await _settings_map(db, tenant_uuid, [u.id])).get(u.id, {})
    c = _classify(u.deleted_at, bool(u.is_active), stored)
    tomb = (c or {}).get("tombstone") or {}
    export["generated_by"] = "admin"
    export["account_status"] = {
        "state": (c or {}).get("kind") or ("suspended" if not u.is_active else "active"),
        "at": _iso((c or {}).get("at")),
        "reason": (c or {}).get("reason"),
        # The member's own contact details, moved off the row when they deleted.
        "email_at_deletion": tomb.get("email"),
        "phone_at_deletion": tomb.get("phone"),
    }

    label = _full_name(p.first_name if p else None, p.last_name if p else None) or u.membership_number or u.email or tomb.get("email")
    await record_admin_action(
        db, current_user, "gdpr.export", tenant_id=tenant_uuid,
        target_type="user", target_id=u.id, target_label=label,
        details={"account_state": export["account_status"]["state"], "sections": sorted(k for k, v in export.items() if isinstance(v, (list, dict)))},
    )
    logger.info("admin_gdpr_export", admin=current_user.get("sub"), target=str(u.id))
    return APIResponse(success=True, data=export)


@router.post("/data-requests/{user_id}/restore", response_model=APIResponse[dict])
async def restore_account(
    user_id: uuid.UUID,
    payload: ReasonIn,
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Undo a soft-delete made by staff, or a member's own deactivation.

    Deliberately refuses accounts the MEMBER deleted: their Firebase sign-in is
    gone and their email/phone were moved off the row, so the plain
    deleted_at=NULL flip would leave a record nobody can sign in to. Those are
    erasure requests, not restorable accounts.
    """
    from app.routers.auth import _write_account_settings

    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    row = (await db.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.id == user_id, User.tenant_id == tenant_uuid)
    )).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    u, p = row
    stored = (await _settings_map(db, tenant_uuid, [u.id])).get(u.id, {})
    c = _classify(u.deleted_at, bool(u.is_active), stored)
    if c is None:
        raise HTTPException(
            status_code=409,
            detail=("This account is active — there's nothing to restore." if u.is_active
                    else "This account was suspended by staff. Use Activate on the member's page."),
        )
    if not c["restorable"]:
        raise HTTPException(status_code=409, detail=c["restore_blocker"])

    label = _full_name(p.first_name if p else None, p.last_name if p else None) or u.email or u.membership_number
    if c["kind"] == "deleted_by_admin":
        u.deleted_at = None
        u.is_active = True
        if p is not None and p.deleted_at is not None and p.tenant_id == tenant_uuid:
            p.deleted_at = None
        action = "user.restore"
    else:  # deactivated_by_member
        u.is_active = True
        stored = dict(stored)
        stored.pop("deactivation", None)
        stored["reactivated_at"] = datetime.now(timezone.utc).isoformat()
        stored["reactivated_by"] = "admin"
        await _write_account_settings(db, u.id, stored)
        action = "user.activate"
    await db.flush()

    await record_admin_action(
        db, current_user, action, tenant_id=tenant_uuid,
        target_type="user", target_id=u.id, target_label=label,
        summary=payload.reason, details={"from": c["kind"], "via": "data_requests"},
    )
    logger.info("admin_restore_account", admin=current_user.get("sub"), target=str(u.id), kind=c["kind"])
    return APIResponse(success=True, data={"id": str(u.id), "restored_from": c["kind"], "is_active": True},
                       message="Account restored.")


# ═════════════════════════════════════════════════════════════════════════════
# Integrations health
# ═════════════════════════════════════════════════════════════════════════════
#
# Rules: booleans and MASKED identifiers only — never a key, secret, token, DSN
# or connection string. Live checks are read-only: no emails, no charges, no
# writes. Error text shown to the admin is written here, never copied from a
# provider response or an exception (which could echo a credential).

_PROBE_TIMEOUT = 6.0


def _mask(value: str | None, head: int = 3, tail: int = 3) -> str | None:
    """`match4marriage-prod` → `mat…rod`. Short values are fully masked."""
    if not value:
        return None
    s = str(value)
    if len(s) <= head + tail + 2:
        return "•" * len(s)
    return f"{s[:head]}…{s[-tail:]}"


def _mask_email_addr(value: str | None) -> str | None:
    if not value or "@" not in value:
        return _mask(value)
    local, domain = value.split("@", 1)
    return f"{local[:2]}…@{domain}"


def _host_of(url: str | None) -> str | None:
    try:
        return urlsplit(url or "").hostname
    except ValueError:
        return None


def _svc(key: str, name: str, purpose: str) -> dict[str, Any]:
    return {
        "key": key, "name": name, "purpose": purpose,
        "configured": False, "status": "not_configured", "detail": "",
        "identifiers": {}, "live_checked": False, "latency_ms": None, "action": None,
    }


async def _timed(coro) -> tuple[Any, int]:
    t0 = time.perf_counter()
    res = await asyncio.wait_for(coro, timeout=_PROBE_TIMEOUT)
    return res, int((time.perf_counter() - t0) * 1000)


# ── Probes (module-level so tests can replace them; all read-only) ───────────


def _http_get(url: str, *, headers: dict[str, str] | None = None, auth: tuple[str, str] | None = None) -> tuple[int, Any]:
    """GET → (status_code, parsed JSON or None). Never raises on HTTP errors."""
    import requests
    resp = requests.get(url, headers=headers or {}, auth=auth, timeout=_PROBE_TIMEOUT - 1)
    try:
        body = resp.json()
    except ValueError:
        body = None
    return resp.status_code, body


def _probe_firebase(fb_app: Any) -> str:
    """Look up an address that cannot exist. 'not found' proves the service
    account can talk to this project's Auth; nothing is created or changed."""
    from firebase_admin import auth as fb_auth
    try:
        fb_auth.get_user_by_email("integration-health-check@m4m-healthcheck.invalid", app=fb_app)
        return "ok"
    except fb_auth.UserNotFoundError:
        return "ok"


def _probe_paypal(cfg: Any) -> None:
    """Client-credentials token fetch — authenticates, creates nothing."""
    from app.services import paypal as paypal_svc
    paypal_svc._access_token(cfg)


async def _check_database(db: AsyncSession) -> dict[str, Any]:
    s = _svc("database", "Database", "Members, profiles, payments — everything.")
    url = settings.DATABASE_URL or ""
    is_sqlite = url.startswith("sqlite")
    host = _host_of(url)
    s["configured"] = bool(url) and not is_sqlite
    s["identifiers"] = {
        "engine": "SQLite (local file)" if is_sqlite else "PostgreSQL",
        "host": _mask(host, 6, 9) if host else None,
        "provider": "Neon" if host and "neon.tech" in host else None,
    }
    try:
        async def _run():
            async with db.begin_nested():
                await db.execute(sa_text("SELECT 1"))
                return db.bind.dialect.name if db.bind is not None else None
        dialect, ms = await _timed(_run())
        s.update(live_checked=True, latency_ms=ms)
        if is_sqlite and settings.is_production:
            s.update(status="error", detail="Production is running on a local SQLite file — data is lost on redeploy.",
                     action="Set DATABASE_URL to the managed Postgres URL.")
        elif is_sqlite:
            s.update(status="warning", detail="Connected to a local SQLite file (development default).",
                     action="Set DATABASE_URL to a managed Postgres URL before going live.")
        else:
            s.update(status="ok", detail=f"Connected ({dialect or 'postgresql'}).")
    except Exception as exc:
        logger.warning("integration_db_check_failed", error_type=type(exc).__name__)
        s.update(live_checked=True, status="error", detail="The database did not answer a test query.",
                 action="Check DATABASE_URL and the database provider's status page.")
    return s


async def _check_redis() -> dict[str, Any]:
    s = _svc("redis", "Redis", "One-time codes, email-change codes, password-reset throttles and rate limits.")
    url = settings.REDIS_URL or ""
    host = _host_of(url)
    local = (host or "") in ("localhost", "127.0.0.1", "")
    s["configured"] = bool(url) and not local
    try:
        from app.core import rate_limit as _rl
        limiter_in_memory = getattr(_rl, "_storage", "") == "memory://"
    except Exception:
        limiter_in_memory = None
    s["identifiers"] = {
        "host": "localhost" if local else _mask(host, 4, 8),
        "tls": url.startswith("rediss://"),
        "rate_limiter_storage": "in-memory" if limiter_in_memory else ("redis" if limiter_in_memory is False else None),
    }
    try:
        from app.core.redis import get_redis

        async def _run():
            r = await get_redis()
            await r.ping()
            return r
        r, ms = await _timed(_run())
        is_fake = type(r).__module__.split(".")[0] == "fakeredis"
        s.update(live_checked=True, latency_ms=ms)
        s["identifiers"]["mode"] = "in-memory fallback (fakeredis)" if is_fake else "real Redis server"
        if is_fake:
            s.update(
                status="error" if settings.is_production else "warning",
                detail=("No Redis server is reachable, so the app is using an in-memory stand-in. Codes and throttles live "
                        "inside one server instance only and vanish on every cold start — on serverless hosting a code "
                        "issued by one instance may not be found by the next."),
                action="Create a managed Redis (e.g. Upstash) and set REDIS_URL in the backend environment.",
            )
        elif limiter_in_memory:
            s.update(status="warning", detail="Redis is connected, but the rate limiter fell back to in-memory storage at boot.",
                     action="Redeploy the backend so the rate limiter reconnects to Redis.")
        else:
            s.update(status="ok", detail="Connected to a real Redis server.")
    except Exception as exc:
        logger.warning("integration_redis_check_failed", error_type=type(exc).__name__)
        s.update(live_checked=True, status="error", detail="Redis did not answer a PING.",
                 action="Check REDIS_URL.")
    return s


async def _check_firebase(live: bool) -> dict[str, Any]:
    s = _svc("firebase", "Firebase Admin", "Sign-in: verifies every member and admin session; admin roles.")
    have = [bool(settings.FIREBASE_PROJECT_ID), bool(settings.FIREBASE_CLIENT_EMAIL), bool(settings.FIREBASE_PRIVATE_KEY)]
    s["configured"] = all(have)
    s["identifiers"] = {
        "project_id": _mask(settings.FIREBASE_PROJECT_ID, 4, 3),
        "service_account": _mask_email_addr(settings.FIREBASE_CLIENT_EMAIL),
        "private_key_set": have[2],
    }
    if not s["configured"]:
        s.update(status="error", detail="Firebase service-account credentials are missing — nobody can sign in.",
                 action="Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.")
        return s
    try:
        from app.core.firebase import get_firebase_app
        fb_app = get_firebase_app()
    except Exception:
        fb_app = None
    if fb_app is None:
        s.update(status="error", detail="The credentials are set but the Firebase SDK could not initialise with them.",
                 action="Re-paste FIREBASE_PRIVATE_KEY (keep the \\n line breaks) from the service-account JSON.")
        return s
    if not live:
        s.update(status="unchecked", detail="Credentials loaded. Run the live check to confirm they are accepted.")
        return s
    try:
        _, ms = await _timed(asyncio.to_thread(_probe_firebase, fb_app))
        s.update(live_checked=True, latency_ms=ms, status="ok", detail="Service account accepted by Firebase Auth.")
    except Exception as exc:
        logger.warning("integration_firebase_check_failed", error_type=type(exc).__name__)
        s.update(live_checked=True, status="error", detail="Firebase rejected the service account or did not respond.",
                 action="Check the service-account key hasn't been rotated or deleted in the Firebase console.")
    return s


async def _check_resend(live: bool) -> dict[str, Any]:
    s = _svc("resend", "Resend (email)", "Verification codes, password resets, welcome emails and admin messages.")
    from_email = str(settings.RESEND_FROM_EMAIL or "")
    domain = from_email.split("@", 1)[1].lower() if "@" in from_email else None
    s["configured"] = bool(settings.RESEND_API_KEY)
    s["identifiers"] = {"from_address": from_email or None, "sending_domain": domain, "api_key_set": s["configured"]}
    if not s["configured"]:
        s.update(status="error", detail="No email API key — the site cannot send any email.",
                 action="Set RESEND_API_KEY (and RESEND_FROM_EMAIL on a verified domain).")
        return s
    if not live:
        s.update(status="unchecked", detail="API key set. Run the live check to confirm the key and sending domain.")
        return s
    try:
        (code, body), ms = await _timed(asyncio.to_thread(
            _http_get, "https://api.resend.com/domains",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        ))
        s.update(live_checked=True, latency_ms=ms)
        err_name = (body or {}).get("name") if isinstance(body, dict) else None
        if code == 200:
            domains = (body or {}).get("data") if isinstance(body, dict) else None
            match = next((d for d in (domains or []) if isinstance(d, dict) and str(d.get("name", "")).lower() == domain), None)
            if match is None:
                s.update(status="warning", detail=f"The key works, but {domain} is not a domain on this Resend account — mail from it will be rejected.",
                         action=f"Add and verify {domain} in Resend, or change RESEND_FROM_EMAIL.")
            elif str(match.get("status", "")).lower() != "verified":
                s.update(status="warning", detail=f"The key works, but {domain} is not verified yet (status: {str(match.get('status'))[:20]}).",
                         action="Finish the DNS records for the domain in Resend.")
            else:
                s.update(status="ok", detail=f"Key accepted and {domain} is verified. No email was sent.")
        elif err_name == "restricted_api_key":
            s.update(status="ok", detail="Key accepted (send-only key, so the domain status can't be read). No email was sent.")
        elif code in (401, 403):
            s.update(status="error", detail="Resend rejected the API key.", action="Create a new key in Resend and update RESEND_API_KEY.")
        else:
            s.update(status="warning", detail=f"Resend answered with an unexpected status ({code}).")
    except Exception as exc:
        logger.warning("integration_resend_check_failed", error_type=type(exc).__name__)
        s.update(live_checked=True, status="warning", detail="Couldn't reach Resend to check the key.")
    return s


async def _check_cloudinary(live: bool) -> dict[str, Any]:
    s = _svc("cloudinary", "Cloudinary", "Profile photos and identity-document uploads.")
    have = [bool(settings.CLOUDINARY_CLOUD_NAME), bool(settings.CLOUDINARY_API_KEY), bool(settings.CLOUDINARY_API_SECRET)]
    s["configured"] = all(have)
    s["identifiers"] = {
        "cloud_name": _mask(settings.CLOUDINARY_CLOUD_NAME, 2, 2),
        "api_key": ("…" + settings.CLOUDINARY_API_KEY[-4:]) if len(settings.CLOUDINARY_API_KEY or "") >= 8 else None,
        "api_secret_set": have[2],
        "upload_folder": settings.CLOUDINARY_UPLOAD_FOLDER,
    }
    if not s["configured"]:
        s.update(status="error", detail="Cloudinary credentials are missing — members can't upload photos or ID documents.",
                 action="Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.")
        return s
    if not live:
        s.update(status="unchecked", detail="Credentials set. Run the live check to confirm they are accepted.")
        return s
    try:
        (code, body), ms = await _timed(asyncio.to_thread(
            _http_get, f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/ping",
            auth=(settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET),
        ))
        s.update(live_checked=True, latency_ms=ms)
        if code == 200:
            s.update(status="ok", detail="Credentials accepted. Nothing was uploaded.")
        elif code in (401, 403, 404):
            s.update(status="error", detail="Cloudinary rejected the cloud name or API credentials.",
                     action="Re-copy the cloud name, API key and secret from the Cloudinary dashboard.")
        else:
            s.update(status="warning", detail=f"Cloudinary answered with an unexpected status ({code}).")
    except Exception as exc:
        logger.warning("integration_cloudinary_check_failed", error_type=type(exc).__name__)
        s.update(live_checked=True, status="warning", detail="Couldn't reach Cloudinary to check the credentials.")
    return s


async def _check_paypal(db: AsyncSession, tenant_uuid: uuid.UUID, live: bool) -> dict[str, Any]:
    from app.models.payment_gateway_config import PaymentGatewayConfig, PaymentGatewayName
    from app.services.paypal import PayPalConfig

    s = _svc("paypal", "PayPal", "Online membership payments.")
    try:
        async with db.begin_nested():
            row = (await db.execute(
                select(PaymentGatewayConfig).where(
                    PaymentGatewayConfig.tenant_id == tenant_uuid,
                    PaymentGatewayConfig.gateway == PaymentGatewayName.PAYPAL,
                    PaymentGatewayConfig.deleted_at.is_(None),
                )
            )).scalar_one_or_none()
    except Exception as exc:
        logger.warning("integration_paypal_read_failed", error_type=type(exc).__name__)
        s.update(status="warning", detail="Couldn't read the PayPal settings.")
        return s
    has_keys = bool(row and row.publishable_key and row.secret_key)
    s["configured"] = has_keys
    s["identifiers"] = {
        "client_id": ("…" + row.publishable_key[-4:]) if row and len(row.publishable_key or "") >= 8 else None,
        "client_secret_set": bool(row and row.secret_key),
        "webhook_id_set": bool(row and row.webhook_secret),
        "mode": ("sandbox (test)" if row.is_test_mode else "live") if row else None,
        "enabled": bool(row and row.is_active),
    }
    if not has_keys:
        s.update(status="warning", detail="PayPal isn't set up — members can't pay online (staff can still record offline payments).",
                 action="Add the PayPal REST client ID and secret under Payments → Gateway settings.")
        return s
    notes: list[str] = []
    if not row.is_active:
        notes.append("PayPal is switched off, so checkout is unavailable.")
    if row.is_test_mode and settings.is_production:
        notes.append("It is in SANDBOX mode on the live site — real payments are not being taken.")
    if not row.webhook_secret:
        notes.append("No webhook ID is set, so refunds and missed captures won't sync automatically.")
    if not live:
        s.update(status="warning" if notes else "unchecked",
                 detail=" ".join(notes) or "Credentials saved. Run the live check to confirm PayPal accepts them.",
                 action="Review Payments → Gateway settings." if notes else None)
        return s
    try:
        cfg = PayPalConfig(client_id=row.publishable_key, client_secret=row.secret_key,
                           webhook_id=row.webhook_secret or None, is_sandbox=bool(row.is_test_mode))
        _, ms = await _timed(asyncio.to_thread(_probe_paypal, cfg))
        s.update(live_checked=True, latency_ms=ms)
        if notes:
            s.update(status="warning", detail="PayPal accepted the credentials. " + " ".join(notes),
                     action="Review Payments → Gateway settings.")
        else:
            s.update(status="ok", detail="PayPal accepted the credentials. No order or charge was created.")
    except Exception as exc:
        logger.warning("integration_paypal_check_failed", error_type=type(exc).__name__)
        s.update(live_checked=True, status="error",
                 detail="PayPal rejected the client ID/secret for this mode, or did not respond.",
                 action="Check the credentials match the selected mode (sandbox vs live).")
    return s


def _check_sentry() -> dict[str, Any]:
    s = _svc("sentry", "Sentry", "Error reporting for the API.")
    dsn = os.getenv("SENTRY_DSN", "").strip()
    s["configured"] = bool(dsn)
    if not dsn:
        s.update(status="warning", detail="No DSN set — API errors are only visible in server logs.",
                 action="Set SENTRY_DSN in the backend environment (the website has its own, separate DSN).")
        return s
    try:
        parts = urlsplit(dsn)
        project = parts.path.strip("/").split("/")[-1]
        s["identifiers"] = {"ingest_host": _mask(parts.hostname, 4, 14), "project_id": _mask(project, 2, 2)}
    except ValueError:
        s["identifiers"] = {}
    initialised: bool | None
    try:
        import sentry_sdk
        initialised = bool(sentry_sdk.is_initialized()) if hasattr(sentry_sdk, "is_initialized") else sentry_sdk.Hub.current.client is not None
    except Exception:
        initialised = None
    if initialised is False:
        s.update(status="error", detail="A DSN is set but the Sentry SDK did not start.",
                 action="Check the DSN value and that sentry-sdk is installed in the deployment.")
    else:
        s.update(status="ok", detail="SDK initialised. (No test event is sent from here.)")
    return s


@router.get("/integrations", response_model=APIResponse[dict])
@limiter.limit("20/minute")
async def integrations_health(
    request: Request,
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
    live: bool = Query(default=False, description="Also run the read-only live checks against each provider"),
):
    """Configured / not configured for every third-party service, plus — with
    live=true — a read-only check that the credentials are accepted. Never
    sends email, creates orders or writes anywhere; never returns a secret."""
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)

    # DB-session checks run sequentially (one AsyncSession can't be shared
    # across concurrent tasks); the outbound provider checks run in parallel.
    database = await _check_database(db)
    paypal_task = _check_paypal(db, tenant_uuid, live)
    paypal = await paypal_task
    redis_, firebase, resend_, cloudinary_ = await asyncio.gather(
        _check_redis(), _check_firebase(live), _check_resend(live), _check_cloudinary(live),
    )
    services = [database, redis_, firebase, resend_, cloudinary_, paypal, _check_sentry()]

    order = {"error": 0, "warning": 1, "not_configured": 2, "unchecked": 3, "ok": 4}
    worst = min((s["status"] for s in services), key=lambda x: order.get(x, 9))
    bootstrap = [e for e in (settings.BOOTSTRAP_ADMIN_EMAILS or "").split(",") if e.strip()]
    return APIResponse(success=True, data={
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "live": bool(live),
        "overall": worst,
        "counts": {k: sum(1 for s in services if s["status"] == k) for k in order},
        "services": services,
        "environment": {
            "environment": settings.ENVIRONMENT,
            "app_version": settings.APP_VERSION,
            "frontend_host": _host_of(settings.FRONTEND_URL),
            "demo_mode": bool(settings.DEMO_MODE),
            "debug": bool(settings.DEBUG),
            "boot_ddl_enabled": os.getenv("RUN_BOOT_DDL", "true").lower() not in {"false", "0", "no", "off"},
            "bootstrap_admins": len(bootstrap),
        },
    })
