"""
Matches router.
GET  /api/v1/matches/daily       — ranked "My Matches" feed (up to 20)
POST /api/v1/interests/{match_id} — send interest
GET  /api/v1/interests/received   — received interests
POST /api/v1/quiz/submit          — personality quiz
GET  /api/v1/matches/compatibility/{user_id} — compatibility score
"""
import uuid
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user
from app.core.tenancy import get_current_tenant_slug
from app.models.match import ChatThread, Interest, InterestStatus, Match, MatchStatus
from app.models.personality import PersonalityScore
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.match import (
    CompatibilityScoreRead,
    DailyMatchFeed,
    InterestRead,
    MatchRead,
    QuizSubmitRequest,
    SendInterestRequest,
)

router = APIRouter(tags=["matches"])
logger = get_logger(__name__)


def _get_user_uuid(current_user: dict) -> uuid.UUID | None:
    """Safely extract UUID from current_user sub. Returns None if invalid (demo mode)."""
    try:
        return uuid.UUID(current_user.get("sub", ""))
    except (ValueError, AttributeError):
        return None


async def _resolve_tenant(db: AsyncSession, tenant_slug: str) -> uuid.UUID:
    """Resolve tenant slug -> tenant_id, raise 404 if unknown.
    Matches the helper used elsewhere; imported lazily to avoid a circular
    import on app.routers.profile.
    """
    from app.routers.profile import _resolve_tenant_uuid
    t = await _resolve_tenant_uuid(db, tenant_slug)
    if t is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return t


@router.get("/matches/daily", response_model=APIResponse[DailyMatchFeed])
async def get_daily_matches(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    "My Matches" feed — a ranked list (best first, up to DAILY_MATCH_COUNT) of
    admin-approved, opposite-gender members scored against the caller's
    profile + partner preferences. Members inside every stated preference come
    first ("preferred"); if there are too few, the closest remaining members
    are appended as "broader" matches, labelled with what they fall outside.

    Computed live on each request (so newly approved members appear
    immediately) and persisted best-effort into `matches` for history.
    """
    from datetime import timedelta
    from app.models.user import UserProfile
    from app.services.matching import (
        DAILY_MATCH_COUNT,
        build_profile_card,
        has_any_preference,
        load_feed_candidates,
        normalize_partner_prefs,
        persist_daily_matches,
        rank_candidates,
    )

    now = datetime.now(timezone.utc)
    next_refresh = (now + timedelta(days=1)).date().isoformat() + "T06:00:00+00:00"

    def _empty(reason: str | None) -> APIResponse:
        return APIResponse(success=True, data=DailyMatchFeed(
            matches=[], refreshes_at=next_refresh, remaining_today=0, empty_reason=reason,
        ))

    user_uuid = _get_user_uuid(current_user)
    if user_uuid is None:
        return _empty("invalid_session")

    tenant_uuid = await _resolve_tenant(db, tenant_slug)

    viewer = (await db.execute(
        select(UserProfile).where(
            UserProfile.user_id == user_uuid,
            UserProfile.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if viewer is None:
        return _empty("no_profile")

    candidates = await load_feed_candidates(viewer, tenant_uuid, db)
    ranked = rank_candidates(viewer, candidates, limit=DAILY_MATCH_COUNT)
    if not ranked:
        feed = DailyMatchFeed(
            matches=[], refreshes_at=next_refresh, remaining_today=0,
            has_preferences=has_any_preference(normalize_partner_prefs(viewer.partner_prefs)),
            candidates_considered=len(candidates),
            empty_reason="no_candidates",
        )
        return APIResponse(success=True, data=feed)

    persisted = await persist_daily_matches(user_uuid, tenant_uuid, ranked, db)

    # Which of these members has the caller already sent interest to?
    cand_ids = [e["profile"].user_id for e in ranked]
    sent_ids = set((await db.execute(
        select(Interest.receiver_id).where(
            Interest.sender_id == user_uuid,
            Interest.receiver_id.in_(cand_ids),
            Interest.tenant_id == tenant_uuid,
            Interest.deleted_at.is_(None),
        )
    )).scalars().all())

    today_str = now.date().isoformat()
    items: list[MatchRead] = []
    for e in ranked:
        prof = e["profile"]
        row = persisted.get(prof.user_id)
        items.append(MatchRead(
            # Stable synthetic id when persistence was unavailable.
            id=row.id if row is not None else uuid.uuid5(
                uuid.NAMESPACE_URL, f"m4m-match:{user_uuid}:{prof.user_id}"),
            created_at=row.created_at if row is not None else now,
            updated_at=row.updated_at if row is not None else now,
            user_a_id=user_uuid,
            user_b_id=prof.user_id,
            compatibility_score=float(e["score"]),
            compatibility_breakdown={k: float(v) for k, v in e["breakdown"].items()},
            status=MatchStatus.PENDING,
            match_date=today_str,
            a_super_liked=bool(row.a_super_liked) if row is not None else False,
            b_super_liked=bool(row.b_super_liked) if row is not None else False,
            mutual_at=row.mutual_at if row is not None else None,
            other_profile=build_profile_card(prof),
            match_tier=e["tier"],
            reasons=e["reasons"],
            relaxed_on=e["relaxed"],
            interest_sent=prof.user_id in sent_ids,
        ))

    preferred_count = sum(1 for e in ranked if e["tier"] == "preferred")
    feed = DailyMatchFeed(
        matches=items,
        refreshes_at=next_refresh,
        remaining_today=0,
        preferred_count=preferred_count,
        broader_count=len(ranked) - preferred_count,
        has_preferences=has_any_preference(normalize_partner_prefs(viewer.partner_prefs)),
        candidates_considered=len(candidates),
    )
    logger.info(
        "match_feed_built", user_id=str(user_uuid), shown=len(items),
        preferred=preferred_count, pool=len(candidates),
    )
    return APIResponse(success=True, data=feed)


@router.post("/interests/{receiver_id}", response_model=APIResponse[InterestRead])
async def send_interest(
    receiver_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    payload: SendInterestRequest = SendInterestRequest(),
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Send interest to another user. Body is optional — `receiver_id` comes
    from the URL path; only `is_super_interest`, `match_id`, and `message`
    are read from body."""
    sender_id = _get_user_uuid(current_user)
    if not sender_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user session")

    if receiver_id == sender_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't send interest to yourself")

    tenant_uuid = await _resolve_tenant(db, tenant_slug)

    # Already sent? Checked before the quota so a member at their monthly
    # limit gets an honest "already sent" rather than an upgrade prompt.
    existing = await db.execute(
        select(Interest.id).where(
            Interest.sender_id == sender_id,
            Interest.receiver_id == receiver_id,
            Interest.tenant_id == tenant_uuid,
        )
    )
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Interest already sent",
        )

    # Is this a reply to an interest they already sent us? (= "Accept")
    reverse_row = (await db.execute(
        select(Interest).where(
            Interest.sender_id == receiver_id,
            Interest.receiver_id == sender_id,
            Interest.tenant_id == tenant_uuid,
            Interest.status == InterestStatus.PENDING,
            Interest.deleted_at.is_(None),
        )
    )).scalar_one_or_none()

    # Expressions-of-interest quota — Basic (free) is capped per CALENDAR
    # MONTH; Premium+ is unlimited. Server-enforced so the client can't
    # bypass. Accepting an interest someone else sent is a reply, not a new
    # expression, so it is never blocked by the quota.
    from app.core.entitlements import get_user_plan, interest_limit
    plan = await get_user_plan(db, sender_id)
    limit = interest_limit(plan)
    if limit is not None and reverse_row is None:
        now = datetime.now(timezone.utc)
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        sent_count = (await db.execute(
            select(func.count()).select_from(Interest).where(
                Interest.sender_id == sender_id,
                Interest.tenant_id == tenant_uuid,
                Interest.deleted_at.is_(None),
                Interest.created_at >= period_start,
            )
        )).scalar_one()
        if sent_count >= limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"You've reached this month's Basic plan limit of {limit} "
                    "expressions of interest. Upgrade to Premium for unlimited."
                ),
            )

    interest = Interest(
        tenant_id=tenant_uuid,
        sender_id=sender_id,
        receiver_id=receiver_id,
        match_id=payload.match_id,
        is_super_interest=payload.is_super_interest,
        message=payload.message,
    )
    try:
        # SAVEPOINT so a double-click race (unique uq_interests_pair) becomes a
        # clean 409 instead of a 500 that poisons the whole transaction.
        async with db.begin_nested():
            db.add(interest)
            await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Interest already sent")

    # Mutual interest → accept both sides and unlock chat
    if reverse_row:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        interest.status = InterestStatus.ACCEPTED
        reverse_row.status = InterestStatus.ACCEPTED
        reverse_row.responded_at = now
        # Create the ChatThread that unlocks messaging for the pair (skip if
        # one already exists — the unique constraint guarantees a single
        # row per (tenant, ordered pair)). Without this, the messaging UI
        # was a dead end even for Premium members because /chats always
        # returned an empty list.
        a_id, b_id = sorted([sender_id, receiver_id], key=str)
        # uq_thread_pair also covers soft-deleted rows, so revive an old
        # thread for this pair rather than inserting a duplicate.
        thread = (await db.execute(
            select(ChatThread).where(
                ChatThread.tenant_id == tenant_uuid,
                ChatThread.user_a_id == a_id,
                ChatThread.user_b_id == b_id,
            )
        )).scalar_one_or_none()
        if thread is None:
            thread = ChatThread(
                tenant_id=tenant_uuid,
                user_a_id=a_id,
                user_b_id=b_id,
                match_id=payload.match_id,
            )
            db.add(thread)
        else:
            thread.deleted_at = None
            thread.is_active = True
        await db.flush()
        logger.info("mutual_interest_chat_unlocked", user_a=str(sender_id), user_b=str(receiver_id))

    # Tell the other member. Accept → the original sender learns they can now
    # message; a new interest → the receiver learns someone is interested.
    from app.services.member_activity import first_name, notify_member
    name = await first_name(db, sender_id)
    if reverse_row:
        await notify_member(
            db, recipient_id=receiver_id, tenant_id=tenant_uuid, type="interest",
            title=f"{name} accepted your interest",
            body=f"You and {name} are now connected. Say hello and start the conversation.",
            action_url=f"/messages/{thread.id}",
            extra={"sender_id": str(sender_id), "thread_id": str(thread.id), "event": "accepted"},
            email_kind="email_interests",
            email_subject=f"{name} accepted your interest on Match4Marriage",
            email_cta="Start the conversation",
        )
    else:
        await notify_member(
            db, recipient_id=receiver_id, tenant_id=tenant_uuid, type="interest",
            title=f"{name} is interested in you",
            body=f"{name} has expressed interest in your profile. Accept to start a conversation.",
            action_url=f"/profile/{sender_id}",
            extra={"sender_id": str(sender_id), "event": "received"},
            email_kind="email_interests",
            email_subject=f"{name} is interested in your profile",
            email_cta="View their profile",
        )

    # Flush + refresh before serialising: the status UPDATE expires the
    # server-side `updated_at`, and reading an expired attribute outside the
    # async context raised MissingGreenlet → 500 on every accept.
    await db.flush()
    await db.refresh(interest)
    logger.info("interest_sent", sender=str(sender_id), receiver=str(receiver_id), mutual=bool(reverse_row))
    return APIResponse(success=True, data=InterestRead.model_validate(interest))


@router.post("/interests/{sender_id}/decline", response_model=APIResponse[InterestRead])
async def decline_interest(
    sender_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Decline an interest another member sent you. No notification is sent —
    the sender simply sees it as declined. Idempotent."""
    me = _get_user_uuid(current_user)
    if not me:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user session")
    tenant_uuid = await _resolve_tenant(db, tenant_slug)
    interest = (await db.execute(
        select(Interest).where(
            Interest.sender_id == sender_id,
            Interest.receiver_id == me,
            Interest.tenant_id == tenant_uuid,
            Interest.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if interest is None:
        raise HTTPException(status_code=404, detail="Interest not found")
    if interest.status == InterestStatus.ACCEPTED:
        raise HTTPException(status_code=409, detail="You've already accepted this interest.")
    if interest.status != InterestStatus.DECLINED:
        interest.status = InterestStatus.DECLINED
        interest.responded_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await db.flush()
        await db.refresh(interest)
    logger.info("interest_declined", receiver=str(me), sender=str(sender_id))
    return APIResponse(success=True, data=InterestRead.model_validate(interest))


@router.get("/interests/status")
async def get_interest_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    user_id: uuid.UUID | None = None,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Lightweight interest state for the caller, so pages can show the real
    button state after a reload: `sent` / `received` map member id → status.
    Pass `user_id` to scope it to one member (profile page)."""
    me = _get_user_uuid(current_user)
    if not me:
        return APIResponse(success=True, data={"sent": {}, "received": {}})
    tenant_uuid = await _resolve_tenant(db, tenant_slug)
    base = (Interest.tenant_id == tenant_uuid, Interest.deleted_at.is_(None))

    sent_q = select(Interest.receiver_id, Interest.status).where(*base, Interest.sender_id == me)
    recv_q = select(Interest.sender_id, Interest.status).where(*base, Interest.receiver_id == me)
    if user_id:
        sent_q = sent_q.where(Interest.receiver_id == user_id)
        recv_q = recv_q.where(Interest.sender_id == user_id)

    sent = {str(uid): st.value for uid, st in (await db.execute(sent_q)).all()}
    received = {str(uid): st.value for uid, st in (await db.execute(recv_q)).all()}
    return APIResponse(success=True, data={"sent": sent, "received": received})


async def _hydrate_profile_cards(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    tenant_uuid: uuid.UUID,
) -> dict[uuid.UUID, dict]:
    """Look up a minimal profile card for each user id and return a dict
    keyed by user_id. Used by the interest endpoints so the frontend can
    render the other party's name/age/city without N+1 round-trips —
    without this the UI used to show "Unknown / age 0" for every row."""
    if not user_ids:
        return {}
    from app.models.user import UserProfile

    unique_ids = list({uid for uid in user_ids if uid})
    rows = (await db.execute(
        select(UserProfile).where(
            UserProfile.user_id.in_(unique_ids),
            UserProfile.tenant_id == tenant_uuid,
            UserProfile.deleted_at.is_(None),
        )
    )).scalars().all()

    today = date.today()
    out: dict[uuid.UUID, dict] = {}
    for p in rows:
        age: int | None = None
        if p.date_of_birth:
            age = today.year - p.date_of_birth.year - (
                (today.month, today.day) < (p.date_of_birth.month, p.date_of_birth.day)
            )
        # Pick a non-premium primary photo URL (premium never the card thumb).
        primary_photo_url: str | None = None
        photos = p.photos or []
        main = [ph for ph in photos if not ph.get("is_premium")]
        for ph in main:
            if ph.get("is_primary"):
                primary_photo_url = ph.get("url")
                break
        if not primary_photo_url and main:
            primary_photo_url = main[0].get("url")
        out[p.user_id] = {
            "user_id": p.user_id,
            "first_name": p.first_name,
            "age": age,
            "city": p.city,
            "state": p.state,
            "occupation": p.occupation,
            "education_level": p.education_level,
            "religion": p.religion,
            "primary_photo_url": primary_photo_url,
            "completeness_score": p.completeness_score,
        }
    return out


@router.get("/interests/received", response_model=PaginatedResponse[InterestRead])
async def get_received_interests(
    page: int = 1,
    limit: int = 20,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    user_id = _get_user_uuid(current_user)
    offset = (page - 1) * limit

    if not user_id:
        return PaginatedResponse.create([], 0, page, limit)

    tenant_uuid = await _resolve_tenant(db, tenant_slug)
    base_filter = (
        Interest.receiver_id == user_id,
        Interest.tenant_id == tenant_uuid,
        Interest.deleted_at.is_(None),
    )

    count_result = await db.execute(select(func.count()).select_from(Interest).where(*base_filter))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Interest)
        .where(*base_filter)
        .order_by(Interest.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    interests = result.scalars().all()

    # Hydrate the senders so the UI doesn't render "Unknown".
    cards = await _hydrate_profile_cards(db, [i.sender_id for i in interests], tenant_uuid)
    items = []
    for i in interests:
        reads = InterestRead.model_validate(i)
        if i.sender_id in cards:
            from app.schemas.user import ProfileCard
            reads.sender_profile = ProfileCard.model_validate(cards[i.sender_id])
        items.append(reads)

    return PaginatedResponse.create(items, total, page, limit)


@router.get("/interests/sent", response_model=PaginatedResponse[InterestRead])
async def get_sent_interests(
    page: int = 1,
    limit: int = 20,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Returns paginated list of interests the current user has sent, with status."""
    user_id = _get_user_uuid(current_user)
    offset = (page - 1) * limit

    if not user_id:
        return PaginatedResponse.create([], 0, page, limit)

    tenant_uuid = await _resolve_tenant(db, tenant_slug)
    base_filter = (
        Interest.sender_id == user_id,
        Interest.tenant_id == tenant_uuid,
        Interest.deleted_at.is_(None),
    )

    count_result = await db.execute(select(func.count()).select_from(Interest).where(*base_filter))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Interest)
        .where(*base_filter)
        .order_by(Interest.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    interests = result.scalars().all()

    cards = await _hydrate_profile_cards(db, [i.receiver_id for i in interests], tenant_uuid)
    items = []
    for i in interests:
        reads = InterestRead.model_validate(i)
        if i.receiver_id in cards:
            from app.schemas.user import ProfileCard
            reads.receiver_profile = ProfileCard.model_validate(cards[i.receiver_id])
        items.append(reads)

    return PaginatedResponse.create(items, total, page, limit)


@router.post("/quiz/submit", response_model=APIResponse[CompatibilityScoreRead])
async def submit_quiz(
    payload: QuizSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Submit personality quiz. Computes Big Five scores. Upserts PersonalityScore row."""
    user_id = _get_user_uuid(current_user)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user session")

    scores = _compute_big_five(payload.responses)

    result = await db.execute(
        select(PersonalityScore).where(
            PersonalityScore.user_id == user_id,
            PersonalityScore.deleted_at.is_(None),
        )
    )
    ps = result.scalar_one_or_none()

    if ps is None:
        tenant_uuid = await _resolve_tenant(db, tenant_slug)
        ps = PersonalityScore(
            tenant_id=tenant_uuid,
            user_id=user_id,
        )
        db.add(ps)

    for key, value in scores.items():
        setattr(ps, key, value)

    ps.quiz_responses = payload.responses
    ps.quiz_version = payload.quiz_version
    # JSON column doesn't track in-place changes; force-mark dirty so the
    # updated responses actually persist when the row already exists.
    flag_modified(ps, "quiz_responses")
    await db.flush()

    logger.info("quiz_submitted", user_id=str(user_id))
    return APIResponse(
        success=True,
        data=CompatibilityScoreRead(
            overall=0.0,
            breakdown={
                "values": scores.get("values_score", 0.0),
                "lifestyle": scores.get("lifestyle_score", 0.0),
                "family": scores.get("family_expectations_score", 0.0),
                "ambition": scores.get("ambition_score", 0.0),
                "communication": scores.get("communication_style_score", 0.0),
            },
        ),
    )


def _compute_big_five(responses: dict[str, int]) -> dict[str, float]:
    """
    Map 60 quiz responses to Big Five + 5 compatibility dimensions.
    Full scoring rubric implemented in Sprint 2 with proper question bank.
    """
    total = len(responses)
    if total == 0:
        return {}
    avg = sum(responses.values()) / total / 5.0  # normalize to 0-1

    return {
        "openness": avg,
        "conscientiousness": avg,
        "extraversion": avg,
        "agreeableness": avg,
        "neuroticism": 1.0 - avg,
        "values_score": avg,
        "lifestyle_score": avg,
        "family_expectations_score": avg,
        "ambition_score": avg,
        "communication_style_score": avg,
    }
