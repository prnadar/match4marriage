"""
Admin operations router — the "console glue" endpoints.

  GET  /admin/search                         global ⌘K search (members + enquiries)
  GET  /admin/nav-counts                     sidebar badge counts
  GET  /admin/audit-log                      filterable audit trail (+ CSV)
  GET  /admin/audit-log/facets               distinct actions / actors for filters
  GET  /admin/verification-review/{user_id}  ID documents + contact + history for review
  POST /admin/verifications/bulk-approve     approve many submitted profiles at once
  GET  /admin/matchmaking/suggestions/{uid}  top suggested matches for a member (read-only)
  GET  /admin/matchmaking/compare            compatibility summary for two members
  POST /admin/matchmaking/introduce          introduce two members (in-app notification)
  GET  /admin/matchmaking/introductions      recent introductions made by the bureau

Every endpoint requires the admin role (router-level dependency) and every
query is tenant-scoped. Compatibility scoring is imported from
app.services.matching — this module never modifies it.
"""
from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user, require_admin
from app.core.tenancy import get_current_tenant_slug
from app.models.admin_audit_log import AdminAuditLog
from app.models.enquiry import Enquiry, EnquiryStatus
from app.models.match import ChatThread, Interest, Match, MatchStatus
from app.models.report import Report, ReportStatus
from app.models.user import User, UserProfile
from app.models.verification import Verification
from app.schemas.common import APIResponse, PaginatedResponse
from app.services.audit import record_admin_action
from app.services.matching import compute_compatibility
from app.services.notifications import create_notification

router = APIRouter(prefix="/admin", tags=["admin-ops"], dependencies=[Depends(require_admin)])
logger = get_logger(__name__)

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[dict, Depends(get_current_user)]


async def _tenant(db: AsyncSession, tenant_slug: str) -> uuid.UUID:
    from app.routers.profile import _resolve_tenant_uuid
    t = await _resolve_tenant_uuid(db, tenant_slug)
    if t is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return t


def _name(p: UserProfile | None) -> str:
    if p is None:
        return "(no profile)"
    return f"{(p.first_name or '').strip()} {(p.last_name or '').strip()}".strip() or "(unnamed)"


def _photo(p: UserProfile | None) -> str | None:
    photos = (p.photos if p else None) or []
    primary = next((ph.get("url") for ph in photos if isinstance(ph, dict) and ph.get("is_primary")), None)
    if primary is None and photos and isinstance(photos[0], dict):
        primary = photos[0].get("url")
    return primary


def _age(dob: date | None) -> int | None:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _enum_val(v: Any) -> Any:
    return getattr(v, "value", v)


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _member_card(u: User, p: UserProfile | None) -> dict[str, Any]:
    return {
        "id": str(u.id),
        "name": _name(p),
        "email": u.email,
        "phone": u.phone,
        "membership_number": u.membership_number,
        "photo_url": _photo(p),
        "city": p.city if p else None,
        "country": p.country if p else None,
        "gender": _enum_val(p.gender) if p and p.gender else None,
        "age": _age(p.date_of_birth) if p else None,
        "religion": _enum_val(p.religion) if p and p.religion else None,
        "occupation": p.occupation if p else None,
        "verification_status": p.verification_status if p else "draft",
        "subscription_tier": _enum_val(u.subscription_tier) if u.subscription_tier else "free",
        "is_active": bool(u.is_active),
        "is_deleted": u.deleted_at is not None,
        "created_at": _iso(u.created_at),
    }


# ─── Global search (⌘K) ──────────────────────────────────────────────────────


@router.get("/search", response_model=APIResponse[dict])
async def global_search(
    db: DbDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
    q: str = Query(default="", max_length=120),
    limit: int = Query(default=8, ge=1, le=25),
):
    """Find members by name, email, phone or membership number, plus enquiries."""
    tenant_uuid = await _tenant(db, tenant_slug)
    term = q.strip()
    if len(term) < 2:
        return APIResponse(success=True, data={"users": [], "enquiries": []})

    ql = f"%{term.lower()}%"
    digits = re.sub(r"\D", "", term)
    full_name = func.lower(func.concat(UserProfile.first_name, " ", UserProfile.last_name))
    clauses = [
        func.lower(User.email).like(ql),
        func.upper(User.membership_number).like(f"%{term.upper()}%"),
        full_name.like(ql),
    ]
    if len(digits) >= 4:
        clauses.append(User.phone.like(f"%{digits[-10:]}%"))

    rows = (await db.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.tenant_id == tenant_uuid, or_(*clauses))
        .order_by(User.deleted_at.is_not(None), User.created_at.desc())
        .limit(limit)
    )).all()
    users = [_member_card(u, p) for u, p in rows]

    enq_clauses = [func.lower(Enquiry.name).like(ql), func.lower(Enquiry.email).like(ql), func.lower(func.coalesce(Enquiry.subject, "")).like(ql)]
    if len(digits) >= 4:
        enq_clauses.append(Enquiry.phone.like(f"%{digits[-10:]}%"))
    enq_rows = (await db.execute(
        select(Enquiry)
        .where(Enquiry.tenant_id == tenant_uuid, Enquiry.deleted_at.is_(None), or_(*enq_clauses))
        .order_by(Enquiry.created_at.desc())
        .limit(5)
    )).scalars().all()
    enquiries = [
        {
            "id": str(e.id), "name": e.name, "email": e.email, "subject": e.subject,
            "status": _enum_val(e.status), "created_at": _iso(e.created_at),
        }
        for e in enq_rows
    ]
    return APIResponse(success=True, data={"users": users, "enquiries": enquiries})


# ─── Sidebar badge counts ────────────────────────────────────────────────────


@router.get("/nav-counts", response_model=APIResponse[dict])
async def nav_counts(
    db: DbDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    tenant_uuid = await _tenant(db, tenant_slug)
    overdue_cutoff = datetime.utcnow() - timedelta(days=2)  # profiles.submitted_at is naive UTC

    pending, overdue = (await db.execute(
        select(
            func.count().filter(UserProfile.verification_status == "submitted"),
            func.count().filter(and_(
                UserProfile.verification_status == "submitted",
                UserProfile.submitted_at.is_not(None),
                UserProfile.submitted_at < overdue_cutoff,
            )),
        ).where(UserProfile.tenant_id == tenant_uuid, UserProfile.deleted_at.is_(None))
    )).one()
    open_reports = (await db.execute(
        select(func.count()).select_from(Report).where(
            Report.tenant_id == tenant_uuid, Report.deleted_at.is_(None), Report.status == ReportStatus.OPEN,
        )
    )).scalar_one()
    new_enquiries = (await db.execute(
        select(func.count()).select_from(Enquiry).where(
            Enquiry.tenant_id == tenant_uuid, Enquiry.deleted_at.is_(None), Enquiry.status == EnquiryStatus.NEW,
        )
    )).scalar_one()
    return APIResponse(success=True, data={
        "pending_verifications": int(pending or 0),
        "overdue_verifications": int(overdue or 0),
        "open_reports": int(open_reports or 0),
        "new_enquiries": int(new_enquiries or 0),
    })


# ─── Audit log ───────────────────────────────────────────────────────────────


def _serialize_audit(r: AdminAuditLog) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "created_at": _iso(r.created_at),
        "actor_id": str(r.actor_id) if r.actor_id else None,
        "actor_email": r.actor_email,
        "action": r.action,
        "target_type": r.target_type,
        "target_id": r.target_id,
        "target_label": r.target_label,
        "summary": r.summary,
        "details": r.details or {},
    }


AUDIT_CSV_COLS = ["created_at", "actor_email", "action", "target_type", "target_id", "target_label", "summary"]


@router.get("/audit-log", response_model=PaginatedResponse[dict])
async def list_audit_log(
    db: DbDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
    action: str | None = Query(default=None, description="exact action or a prefix ending in '.', e.g. 'verification.'"),
    actor: str | None = Query(default=None, description="actor email (exact)"),
    target_id: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=120),
    days: int | None = Query(default=None, ge=1, le=3650),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    format: str | None = Query(default=None, description="json (default) | csv"),
):
    tenant_uuid = await _tenant(db, tenant_slug)
    base = select(AdminAuditLog).where(AdminAuditLog.tenant_id == tenant_uuid, AdminAuditLog.deleted_at.is_(None))
    if action:
        base = base.where(AdminAuditLog.action.like(f"{action}%") if action.endswith(".") else AdminAuditLog.action == action)
    if actor:
        base = base.where(func.lower(AdminAuditLog.actor_email) == actor.strip().lower())
    if target_id:
        base = base.where(AdminAuditLog.target_id == target_id.strip())
    if q:
        ql = f"%{q.strip().lower()}%"
        base = base.where(or_(
            func.lower(func.coalesce(AdminAuditLog.target_label, "")).like(ql),
            func.lower(func.coalesce(AdminAuditLog.summary, "")).like(ql),
            func.lower(func.coalesce(AdminAuditLog.actor_email, "")).like(ql),
        ))
    if days:
        base = base.where(AdminAuditLog.created_at >= datetime.now(timezone.utc) - timedelta(days=days))

    if (format or "").lower() == "csv":
        from app.routers.admin import _csv_row, _stream_csv
        rows = (await db.execute(base.order_by(AdminAuditLog.created_at.desc()).limit(50_000))).scalars().all()
        return _stream_csv(
            filename="audit-log.csv",
            cols=AUDIT_CSV_COLS,
            row_iter=(_csv_row(_serialize_audit(r), AUDIT_CSV_COLS) for r in rows),
        )

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(
        base.order_by(AdminAuditLog.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return PaginatedResponse.create(items=[_serialize_audit(r) for r in rows], total=total, page=page, limit=limit)


@router.get("/audit-log/facets", response_model=APIResponse[dict])
async def audit_log_facets(
    db: DbDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    tenant_uuid = await _tenant(db, tenant_slug)
    actions = (await db.execute(
        select(AdminAuditLog.action, func.count())
        .where(AdminAuditLog.tenant_id == tenant_uuid)
        .group_by(AdminAuditLog.action)
        .order_by(func.count().desc())
    )).all()
    actors = (await db.execute(
        select(AdminAuditLog.actor_email, func.count())
        .where(AdminAuditLog.tenant_id == tenant_uuid, AdminAuditLog.actor_email.is_not(None))
        .group_by(AdminAuditLog.actor_email)
        .order_by(func.count().desc())
        .limit(50)
    )).all()
    return APIResponse(success=True, data={
        "actions": [{"action": a, "count": int(c)} for a, c in actions],
        "actors": [{"email": e, "count": int(c)} for e, c in actors],
    })


# ─── Verification review ─────────────────────────────────────────────────────


def _doc_image(d: Any) -> dict[str, Any] | None:
    if isinstance(d, dict) and d.get("url"):
        return {"url": d.get("url")}
    return None


def _mask(num: str | None) -> str | None:
    if not num:
        return None
    s = str(num)
    return ("•" * max(0, len(s) - 4)) + s[-4:]


@router.get("/verification-review/{user_id}", response_model=APIResponse[dict])
async def verification_review(
    user_id: uuid.UUID,
    db: DbDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Everything a reviewer needs beside the profile: contact + ID docs + history."""
    tenant_uuid = await _tenant(db, tenant_slug)
    row = (await db.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.id == user_id, User.tenant_id == tenant_uuid)
    )).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    u, p = row

    verifs = (await db.execute(
        select(Verification).where(
            Verification.user_id == user_id,
            Verification.tenant_id == tenant_uuid,
            Verification.deleted_at.is_(None),
        ).order_by(Verification.updated_at.desc())
    )).scalars().all()
    documents = []
    for v in verifs:
        pr = v.provider_response or {}
        documents.append({
            "id": str(v.id),
            "type": _enum_val(v.verification_type),
            "status": _enum_val(v.status),
            "doc_type": pr.get("doc_type"),
            "doc_country": pr.get("doc_country"),
            "doc_number_masked": _mask(pr.get("doc_number")),
            "front": _doc_image(pr.get("front")),
            "back": _doc_image(pr.get("back")),
            "selfie": _doc_image(pr.get("selfie")),
            "submitted_at": _iso(v.updated_at or v.created_at),
            "verified_at": _iso(v.verified_at),
        })

    history = (await db.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.tenant_id == tenant_uuid,
            AdminAuditLog.target_id == str(user_id),
        ).order_by(AdminAuditLog.created_at.desc()).limit(20)
    )).scalars().all()

    open_reports = (await db.execute(
        select(func.count()).select_from(Report).where(
            Report.tenant_id == tenant_uuid, Report.reported_user_id == user_id,
            Report.deleted_at.is_(None), Report.status == ReportStatus.OPEN,
        )
    )).scalar_one()

    return APIResponse(success=True, data={
        "user": {
            **_member_card(u, p),
            "is_email_verified": bool(u.is_email_verified),
            "is_phone_verified": bool(u.is_phone_verified),
            "last_active_at": _iso(u.last_active_at),
            "visa_status": p.visa_status if p else None,
        },
        "documents": documents,
        "history": [_serialize_audit(h) for h in history],
        "open_reports_against": int(open_reports or 0),
    })


@router.post("/verifications/bulk-approve", response_model=APIResponse[dict])
async def bulk_approve_verifications(
    payload: dict,
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Approve up to 100 *submitted* profiles. Anything else is skipped, not changed."""
    tenant_uuid = await _tenant(db, tenant_slug)
    raw = payload.get("user_ids") or []
    if not isinstance(raw, list) or not raw:
        raise HTTPException(status_code=400, detail="user_ids must be a non-empty list")
    if len(raw) > 100:
        raise HTTPException(status_code=400, detail="bulk approve is capped at 100 profiles")
    try:
        ids = [uuid.UUID(str(x)) for x in raw]
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="invalid user_id in list")

    profiles = (await db.execute(
        select(UserProfile).where(
            UserProfile.tenant_id == tenant_uuid,
            UserProfile.user_id.in_(ids),
            UserProfile.deleted_at.is_(None),
        )
    )).scalars().all()
    now = datetime.utcnow()
    approved: list[str] = []
    skipped: list[str] = []
    for p in profiles:
        if p.verification_status != "submitted":
            skipped.append(str(p.user_id))
            continue
        p.verification_status = "approved"
        p.rejection_reason = None
        p.reviewed_at = now
        approved.append(str(p.user_id))
    await db.flush()
    for p in profiles:
        if str(p.user_id) in approved:
            await record_admin_action(
                db, current_user, "verification.approve", tenant_id=tenant_uuid,
                target_type="user", target_id=p.user_id, target_label=_name(p),
                summary="Bulk approval",
            )
    found = {str(p.user_id) for p in profiles}
    missing = [str(i) for i in ids if str(i) not in found]
    logger.info("admin_bulk_approve", admin=current_user.get("sub"), approved=len(approved), skipped=len(skipped))
    return APIResponse(success=True, data={
        "approved": approved, "skipped": skipped, "not_found": missing,
    })


# ─── Matchmaking ─────────────────────────────────────────────────────────────


_BREAKDOWN_MAX = {
    "age_preference": 25, "religion": 20, "location": 15, "education": 10,
    "marital_status": 10, "diet_lifestyle": 10, "height_preference": 10,
}


def _mutual_score(a: UserProfile, b: UserProfile) -> dict[str, Any]:
    ab = compute_compatibility(a, b)
    ba = compute_compatibility(b, a)
    return {
        "score": round((ab["score"] + ba["score"]) / 2),
        "a_to_b": ab["score"],
        "b_to_a": ba["score"],
        "breakdown_a_to_b": ab["breakdown"],
        "breakdown_b_to_a": ba["breakdown"],
    }


def _opposite(g: Any) -> Any:
    from app.models.user import Gender
    if g == Gender.MALE:
        return Gender.FEMALE
    if g == Gender.FEMALE:
        return Gender.MALE
    return None


async def _load_member(db: AsyncSession, tenant_uuid: uuid.UUID, user_id: uuid.UUID) -> tuple[User, UserProfile]:
    row = (await db.execute(
        select(User, UserProfile)
        .join(UserProfile, UserProfile.user_id == User.id)
        .where(User.id == user_id, User.tenant_id == tenant_uuid, User.deleted_at.is_(None), UserProfile.deleted_at.is_(None))
    )).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Member (with a profile) not found")
    return row[0], row[1]


async def _introduced_pairs(db: AsyncSession, tenant_uuid: uuid.UUID, user_id: uuid.UUID) -> dict[str, str]:
    """Map other_user_id -> ISO timestamp of the bureau introduction."""
    rows = (await db.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.tenant_id == tenant_uuid,
            AdminAuditLog.action == "match.introduce",
        ).order_by(AdminAuditLog.created_at.desc()).limit(2000)
    )).scalars().all()
    out: dict[str, str] = {}
    for r in rows:
        d = r.details or {}
        a, b = str(d.get("user_a") or ""), str(d.get("user_b") or "")
        other = b if a == str(user_id) else a if b == str(user_id) else None
        if other and other not in out:
            out[other] = _iso(r.created_at) or ""
    return out


@router.get("/matchmaking/suggestions/{user_id}", response_model=APIResponse[dict])
async def match_suggestions(
    user_id: uuid.UUID,
    db: DbDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
    limit: int = Query(default=12, ge=1, le=50),
    include_introduced: bool = Query(default=False),
):
    """Read-only ranking of approved, active members by mutual compatibility."""
    tenant_uuid = await _tenant(db, tenant_slug)
    u, me = await _load_member(db, tenant_uuid, user_id)

    q = (
        select(User, UserProfile)
        .join(UserProfile, UserProfile.user_id == User.id)
        .where(
            User.tenant_id == tenant_uuid,
            User.id != user_id,
            User.deleted_at.is_(None),
            User.is_active == True,  # noqa: E712
            UserProfile.deleted_at.is_(None),
            UserProfile.verification_status == "approved",
        )
    )
    opp = _opposite(me.gender)
    if opp is not None:
        q = q.where(UserProfile.gender == opp)
    pool = (await db.execute(
        q.order_by(User.last_active_at.desc().nullslast()).limit(600)
    )).all()

    introduced = await _introduced_pairs(db, tenant_uuid, user_id)

    # Existing interests either way — the bureau shouldn't "introduce" people
    # who are already talking.
    pool_ids = [cu.id for cu, _ in pool]
    interacted: set[str] = set()
    if pool_ids:
        irows = (await db.execute(
            select(Interest.sender_id, Interest.receiver_id).where(
                Interest.tenant_id == tenant_uuid,
                Interest.deleted_at.is_(None),
                or_(
                    and_(Interest.sender_id == user_id, Interest.receiver_id.in_(pool_ids)),
                    and_(Interest.receiver_id == user_id, Interest.sender_id.in_(pool_ids)),
                ),
            )
        )).all()
        for s, r in irows:
            interacted.add(str(r if s == user_id else s))

    scored = []
    for cu, cp in pool:
        cid = str(cu.id)
        if cid in introduced and not include_introduced:
            continue
        try:
            m = _mutual_score(me, cp)
        except Exception as exc:  # defensive: malformed prefs on one profile
            logger.warning("match_score_failed", candidate=cid, error=str(exc))
            continue
        scored.append({
            **_member_card(cu, cp),
            "score": m["score"],
            "a_to_b": m["a_to_b"],
            "b_to_a": m["b_to_a"],
            "breakdown": m["breakdown_a_to_b"],
            "already_interacted": cid in interacted,
            "introduced_at": introduced.get(cid),
        })
    scored.sort(key=lambda x: (x["already_interacted"], -x["score"]))
    return APIResponse(success=True, data={
        "member": _member_card(u, me),
        "pool_size": len(pool),
        "breakdown_max": _BREAKDOWN_MAX,
        "suggestions": scored[:limit],
    })


async def _pair_context(db: AsyncSession, tenant_uuid: uuid.UUID, a: uuid.UUID, b: uuid.UUID) -> dict[str, Any]:
    pair = or_(
        and_(Interest.sender_id == a, Interest.receiver_id == b),
        and_(Interest.sender_id == b, Interest.receiver_id == a),
    )
    interests = (await db.execute(
        select(Interest).where(Interest.tenant_id == tenant_uuid, Interest.deleted_at.is_(None), pair)
    )).scalars().all()
    mutual = (await db.execute(
        select(func.count()).select_from(Match).where(
            Match.tenant_id == tenant_uuid,
            Match.status == MatchStatus.MUTUAL,
            or_(and_(Match.user_a_id == a, Match.user_b_id == b), and_(Match.user_a_id == b, Match.user_b_id == a)),
        )
    )).scalar_one()
    thread = (await db.execute(
        select(func.count()).select_from(ChatThread).where(
            ChatThread.tenant_id == tenant_uuid,
            or_(and_(ChatThread.user_a_id == a, ChatThread.user_b_id == b), and_(ChatThread.user_a_id == b, ChatThread.user_b_id == a)),
        )
    )).scalar_one()
    introduced = (await _introduced_pairs(db, tenant_uuid, a)).get(str(b))
    return {
        "interests": [
            {"from": str(i.sender_id), "to": str(i.receiver_id), "status": _enum_val(i.status), "created_at": _iso(i.created_at)}
            for i in interests
        ],
        "is_mutual_match": bool(mutual),
        "has_chat": bool(thread),
        "introduced_at": introduced,
    }


def _compare_profile(u: User, p: UserProfile) -> dict[str, Any]:
    prefs = p.partner_prefs or {}
    return {
        **_member_card(u, p),
        "height_cm": p.height_cm,
        "marital_status": _enum_val(p.marital_status) if p.marital_status else None,
        "education_level": p.education_level,
        "mother_tongue": p.mother_tongue,
        "caste": p.caste,
        "diet": (p.family_details or {}).get("diet") or prefs.get("diet"),
        "bio": (p.bio or "")[:600] or None,
        "partner_prefs": {
            k: prefs.get(k) for k in ("min_age", "max_age", "religions", "countries", "min_height_cm", "max_height_cm", "diet")
            if prefs.get(k) not in (None, "", [])
        },
    }


@router.get("/matchmaking/compare", response_model=APIResponse[dict])
async def match_compare(
    db: DbDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
    a: uuid.UUID = Query(...),
    b: uuid.UUID = Query(...),
):
    if a == b:
        raise HTTPException(status_code=400, detail="Pick two different members")
    tenant_uuid = await _tenant(db, tenant_slug)
    ua, pa = await _load_member(db, tenant_uuid, a)
    ub, pb = await _load_member(db, tenant_uuid, b)
    m = _mutual_score(pa, pb)
    return APIResponse(success=True, data={
        "a": _compare_profile(ua, pa),
        "b": _compare_profile(ub, pb),
        "compatibility": {**m, "breakdown_max": _BREAKDOWN_MAX},
        "context": await _pair_context(db, tenant_uuid, a, b),
    })


@router.post("/matchmaking/introduce", response_model=APIResponse[dict])
async def match_introduce(
    payload: dict,
    db: DbDep,
    current_user: UserDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Introduce two approved members. Each receives an in-app notification that
    links to the other's profile, optionally carrying a personal note from the
    bureau. Recorded in the audit log as `match.introduce`.
    """
    tenant_uuid = await _tenant(db, tenant_slug)
    try:
        a = uuid.UUID(str(payload.get("user_a")))
        b = uuid.UUID(str(payload.get("user_b")))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="user_a and user_b must be member ids")
    if a == b:
        raise HTTPException(status_code=400, detail="Pick two different members")
    note = (payload.get("note") or "").strip()[:500]

    ua, pa = await _load_member(db, tenant_uuid, a)
    ub, pb = await _load_member(db, tenant_uuid, b)
    for usr, prof in ((ua, pa), (ub, pb)):
        if prof.verification_status != "approved":
            raise HTTPException(status_code=400, detail=f"{_name(prof)} isn't approved yet — approve their profile before introducing them")
        if not usr.is_active:
            raise HTTPException(status_code=400, detail=f"{_name(prof)} is suspended")

    m = _mutual_score(pa, pb)
    for recipient, other_user, other_prof in ((pa, ub, pb), (pb, ua, pa)):
        first = (other_prof.first_name or "someone").strip()
        body = f"Our matchmaking team thinks you and {first} could be a wonderful match ({m['score']}% compatible). Take a look at their profile."
        if note:
            body += f"\n\nA note from the team: {note}"
        n = await create_notification(
            user_id=recipient.user_id,
            tenant_id=tenant_uuid,
            type="introduction",
            title=f"We'd like to introduce you to {first}",
            body=body,
            action_url=f"/profile/{other_user.id}",
            db=db,
        )
        n.extra_data = {"introduced_user_id": str(other_user.id), "score": m["score"], "source": "admin"}

    await record_admin_action(
        db, current_user, "match.introduce", tenant_id=tenant_uuid,
        target_type="user", target_id=a, target_label=f"{_name(pa)} & {_name(pb)}",
        summary=note or None,
        details={"user_a": str(a), "user_b": str(b), "score": m["score"], "user_a_name": _name(pa), "user_b_name": _name(pb)},
    )
    await db.flush()
    logger.info("admin_match_introduce", admin=current_user.get("sub"), a=str(a), b=str(b), score=m["score"])
    return APIResponse(success=True, data={"user_a": str(a), "user_b": str(b), "score": m["score"]})


@router.get("/matchmaking/introductions", response_model=APIResponse[list[dict]])
async def list_introductions(
    db: DbDep,
    tenant_slug: str = Depends(get_current_tenant_slug),
    limit: int = Query(default=30, ge=1, le=200),
):
    tenant_uuid = await _tenant(db, tenant_slug)
    rows = (await db.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.tenant_id == tenant_uuid,
            AdminAuditLog.action == "match.introduce",
        ).order_by(AdminAuditLog.created_at.desc()).limit(limit)
    )).scalars().all()

    # Outcome: did either side send an interest after the introduction?
    out = []
    for r in rows:
        d = r.details or {}
        item = {
            "id": str(r.id),
            "created_at": _iso(r.created_at),
            "actor_email": r.actor_email,
            "user_a": d.get("user_a"), "user_b": d.get("user_b"),
            "user_a_name": d.get("user_a_name"), "user_b_name": d.get("user_b_name"),
            "score": d.get("score"),
            "note": r.summary,
            "outcome": "pending",
        }
        try:
            a, b = uuid.UUID(str(d.get("user_a"))), uuid.UUID(str(d.get("user_b")))
            statuses = (await db.execute(
                select(Interest.status).where(
                    Interest.tenant_id == tenant_uuid,
                    Interest.deleted_at.is_(None),
                    Interest.created_at >= r.created_at,
                    or_(and_(Interest.sender_id == a, Interest.receiver_id == b),
                        and_(Interest.sender_id == b, Interest.receiver_id == a)),
                )
            )).scalars().all()
            vals = {_enum_val(s) for s in statuses}
            if "accepted" in vals:
                item["outcome"] = "connected"
            elif vals:
                item["outcome"] = "interest_sent"
        except (TypeError, ValueError):
            pass
        out.append(item)
    return APIResponse(success=True, data=out)
