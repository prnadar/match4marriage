"""
Matches router.
GET  /api/v1/matches/daily       — today's 5 curated matches
POST /api/v1/interests/{match_id} — send interest
GET  /api/v1/interests/received   — received interests
POST /api/v1/quiz/submit          — personality quiz
GET  /api/v1/matches/compatibility/{user_id} — compatibility score
"""
import uuid
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, or_, select
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
from app.services.matching import compute_compatibility

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
    """Returns today's curated matches. Generated daily at 06:00 UK time."""
    today_str = date.today().isoformat()
    next_refresh = f"{date.today().isoformat()}T06:00:00+00:00"  # 06:00 UK (GMT)
    user_id_raw = current_user.get("sub", "")

    # Validate UUID — if not valid (demo-placeholder etc), return empty feed
    try:
        user_uuid = uuid.UUID(user_id_raw)
    except (ValueError, AttributeError):
        feed = DailyMatchFeed(matches=[], refreshes_at=next_refresh, remaining_today=5)
        return APIResponse(success=True, data=feed)

    result = await db.execute(
        select(Match).where(
            and_(
                or_(Match.user_a_id == user_uuid, Match.user_b_id == user_uuid),
                Match.match_date == today_str,
                Match.status == MatchStatus.PENDING,
                Match.deleted_at.is_(None),
            )
        )
    )
    matches = result.scalars().all()

    # Fallback: generate matches inline if none exist for today (new user or pre-Celery)
    if not matches:
        from app.models.user import User
        from app.services.matching import generate_daily_matches
        user_obj_result = await db.execute(
            select(User).where(User.id == user_uuid, User.deleted_at.is_(None))
        )
        user_obj = user_obj_result.scalar_one_or_none()
        if user_obj and user_obj.tenant_id:
            await generate_daily_matches(user_uuid, user_obj.tenant_id, db)
            # Re-query after generation
            result2 = await db.execute(
                select(Match).where(
                    and_(
                        or_(Match.user_a_id == user_uuid, Match.user_b_id == user_uuid),
                        Match.match_date == today_str,
                        Match.status == MatchStatus.PENDING,
                        Match.deleted_at.is_(None),
                    )
                )
            )
            matches = result2.scalars().all()

    feed = DailyMatchFeed(
        matches=[MatchRead.model_validate(m) for m in matches],
        refreshes_at=next_refresh,
        remaining_today=max(0, 5 - len(matches)),
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

    tenant_uuid = await _resolve_tenant(db, tenant_slug)

    # Expressions-of-interest quota — Basic (free) is capped per CALENDAR
    # MONTH; Premium+ is unlimited. The earlier implementation counted
    # lifetime interests, which permanently blocked a Basic member after
    # 10 interests (even after upgrading + downgrading). Server-enforced so
    # the client can't bypass.
    from datetime import datetime, timezone
    from app.core.entitlements import get_user_plan, interest_limit
    plan = await get_user_plan(db, sender_id)
    limit = interest_limit(plan)
    if limit is not None:
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

    # Check for existing interest
    existing = await db.execute(
        select(Interest).where(
            Interest.sender_id == sender_id,
            Interest.receiver_id == receiver_id,
            Interest.tenant_id == tenant_uuid,
            Interest.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Interest already sent",
        )

    interest = Interest(
        tenant_id=tenant_uuid,
        sender_id=sender_id,
        receiver_id=receiver_id,
        match_id=payload.match_id,
        is_super_interest=payload.is_super_interest,
        message=payload.message,
    )
    db.add(interest)
    await db.flush()

    # Check for mutual interest → unlock chat
    reverse = await db.execute(
        select(Interest).where(
            Interest.sender_id == receiver_id,
            Interest.receiver_id == sender_id,
            Interest.tenant_id == tenant_uuid,
            Interest.status == InterestStatus.PENDING,
            Interest.deleted_at.is_(None),
        )
    )
    reverse_row = reverse.scalar_one_or_none()
    if reverse_row:
        interest.status = InterestStatus.ACCEPTED
        reverse_row.status = InterestStatus.ACCEPTED
        # Create the ChatThread that unlocks messaging for the pair (skip if
        # one already exists — the unique constraint guarantees a single
        # row per (tenant, ordered pair)). Without this, the messaging UI
        # was a dead end even for Premium members because /chats always
        # returned an empty list.
        a_id, b_id = sorted([sender_id, receiver_id], key=str)
        existing_thread = await db.execute(
            select(ChatThread).where(
                ChatThread.tenant_id == tenant_uuid,
                ChatThread.user_a_id == a_id,
                ChatThread.user_b_id == b_id,
                ChatThread.deleted_at.is_(None),
            )
        )
        if existing_thread.scalar_one_or_none() is None:
            db.add(ChatThread(
                tenant_id=tenant_uuid,
                user_a_id=a_id,
                user_b_id=b_id,
                match_id=payload.match_id,
            ))
            await db.flush()
        logger.info("mutual_interest_chat_unlocked", user_a=str(sender_id), user_b=str(receiver_id))

    logger.info("interest_sent", sender=str(sender_id), receiver=str(receiver_id))
    return APIResponse(success=True, data=InterestRead.model_validate(interest))


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
