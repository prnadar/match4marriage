"""
Profile router.
GET  /api/v1/profile/browse         — search/browse profiles
GET  /api/v1/profile/{user_id}
PUT  /api/v1/profile/{user_id}
POST /api/v1/profile/photos
POST /api/v1/profile/voice-note
DELETE /api/v1/profile/photos/{s3_key}
"""
import uuid
from datetime import date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.rate_limit import BROWSE_LIMIT, limiter
from app.core.security import get_current_user
from app.core.tenancy import get_current_tenant_slug
from app.models.user import MaritalStatus, Religion, User, UserProfile
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.user import ProfileCard, ProfileCreate, ProfileRead, ProfileUpdate
from app.services.storage import generate_photo_upload_signature, generate_upload_url
from app.services.trust_score import compute_profile_completeness, compute_trust_score

router = APIRouter(prefix="/profile", tags=["profile"])
logger = get_logger(__name__)


@router.get("/trust-score", response_model=APIResponse[dict])
async def get_trust_score(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Returns the current user's trust score (0-100) and a per-signal breakdown.

    Breakdown signals:
      - email:   email verified (+20 pts)
      - mobile:  phone verified (+20 pts)
      - id:      Aadhaar or PAN verified (+30 pts)
      - profile: profile ≥80% complete (+20 pts)
      - linkedin: LinkedIn verified (+10 pts)
    """
    result = await compute_trust_score(current_user, db)
    return APIResponse(success=True, data=result)


@router.get("/browse", response_model=PaginatedResponse[ProfileCard])
@limiter.limit(BROWSE_LIMIT)
async def browse_profiles(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    # Age range
    min_age: int | None = Query(default=None, ge=18, le=100),
    max_age: int | None = Query(default=None, ge=18, le=100),
    # Filters
    religion: Religion | None = Query(default=None),
    location: str | None = Query(default=None, description="City or state (case-insensitive)"),
    education: str | None = Query(default=None, description="Partial match on education_level"),
    marital_status: MaritalStatus | None = Query(default=None),
    has_photo: bool | None = Query(default=None, description="If true, return only profiles with at least one photo"),
    # Pagination
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
):
    """
    Browse / search active profiles.

    - Filtered by caller's tenant.
    - Excludes caller's own profile.
    - Excludes soft-deleted profiles.
    - Ordered by created_at DESC (newest first).
    - Returns a minimal ProfileCard per result.
    """
    from sqlalchemy import text as sa_text

    # Resolve tenant UUID from slug
    tenant_result = await db.execute(
        sa_text("SELECT id FROM tenants WHERE slug = :slug LIMIT 1"),
        {"slug": tenant_slug},
    )
    tenant_row = tenant_result.fetchone()
    if not tenant_row:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant_uuid = tenant_row[0]

    # Resolve calling user's UUID
    raw_sub = current_user.get("sub") or current_user.get("user_id", "")
    try:
        caller_id = uuid.UUID(str(raw_sub))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="Invalid user identity in token")

    offset = (page - 1) * limit

    # Build base query — join UserProfile → User to get trust_score
    base_q = (
        select(UserProfile, User)
        .join(User, User.id == UserProfile.user_id)
        .where(
            UserProfile.tenant_id == tenant_uuid,
            UserProfile.deleted_at.is_(None),
            User.deleted_at.is_(None),
            User.is_active == True,  # noqa: E712
            UserProfile.user_id != caller_id,
            UserProfile.verification_status == "approved",
        )
    )

    # Age range — computed from date_of_birth
    today = date.today()
    if min_age is not None:
        max_dob = date(today.year - min_age, today.month, today.day)
        base_q = base_q.where(UserProfile.date_of_birth <= max_dob)
    if max_age is not None:
        min_dob = date(today.year - max_age - 1, today.month, today.day)
        base_q = base_q.where(UserProfile.date_of_birth >= min_dob)

    # Enum filters
    if religion is not None:
        base_q = base_q.where(UserProfile.religion == religion)
    if marital_status is not None:
        base_q = base_q.where(UserProfile.marital_status == marital_status)

    # Text filters (case-insensitive partial match)
    if location:
        loc_lower = f"%{location.lower()}%"
        from sqlalchemy import or_, func as sqlfunc
        base_q = base_q.where(
            or_(
                sqlfunc.lower(UserProfile.city).like(loc_lower),
                sqlfunc.lower(UserProfile.state).like(loc_lower),
            )
        )
    if education:
        from sqlalchemy import func as sqlfunc
        base_q = base_q.where(
            sqlfunc.lower(UserProfile.education_level).like(f"%{education.lower()}%")
        )

    # Photo filter — photos is a JSON array; non-empty means has_photo
    if has_photo is True:
        # JSON array length > 0 — works in PostgreSQL
        from sqlalchemy import cast, Integer, text as sa_text2
        base_q = base_q.where(
            sa_text2("jsonb_array_length(profiles.photos::jsonb) > 0")
        )
    elif has_photo is False:
        from sqlalchemy import text as sa_text3
        base_q = base_q.where(
            sa_text3("jsonb_array_length(profiles.photos::jsonb) = 0")
        )

    # Total count
    count_q = select(func.count()).select_from(base_q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    # Paginated rows
    rows_q = base_q.order_by(UserProfile.created_at.desc()).offset(offset).limit(limit)
    rows = (await db.execute(rows_q)).all()

    def _age(dob: date | None) -> int | None:
        if dob is None:
            return None
        today_ = date.today()
        return today_.year - dob.year - ((today_.month, today_.day) < (dob.month, dob.day))

    def _primary_photo(photos: list[dict]) -> str | None:
        for p in photos:
            if p.get("is_primary"):
                return p.get("url")
        return photos[0].get("url") if photos else None

    cards: list[ProfileCard] = []
    for profile_row, user_row in rows:
        cards.append(
            ProfileCard(
                user_id=profile_row.user_id,
                first_name=profile_row.first_name,
                age=_age(profile_row.date_of_birth),
                city=profile_row.city,
                state=profile_row.state,
                occupation=profile_row.occupation,
                education_level=profile_row.education_level,
                religion=profile_row.religion,
                primary_photo_url=_primary_photo(profile_row.photos or []),
                trust_score=user_row.trust_score,
                completeness_score=profile_row.completeness_score,
            )
        )

    logger.info(
        "profiles_browsed",
        caller_id=str(caller_id),
        tenant=tenant_slug,
        total=total,
        page=page,
    )
    return PaginatedResponse.create(items=cards, total=total, page=page, limit=limit)


async def _get_or_create_own_profile(
    db: AsyncSession,
    current_user: dict,
    tenant_slug: str,
) -> UserProfile:
    from sqlalchemy import text as sa_text
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(
        select(UserProfile).where(
            UserProfile.user_id == user_id,
            UserProfile.deleted_at.is_(None),
        )
    )
    profile = result.scalar_one_or_none()
    if profile:
        return profile

    tenant_row = (await db.execute(
        sa_text("SELECT id FROM tenants WHERE slug = :slug LIMIT 1"), {"slug": tenant_slug}
    )).fetchone()
    tenant_uuid = tenant_row[0] if tenant_row else None
    await db.execute(
        sa_text(
            "INSERT INTO users (id, tenant_id, is_phone_verified, created_at, updated_at) "
            "VALUES (:uid, :tid, true, NOW(), NOW()) ON CONFLICT (id) DO NOTHING"
        ),
        {"uid": str(user_id), "tid": str(tenant_uuid)},
    )
    await db.flush()
    profile = UserProfile(
        id=uuid.uuid4(),
        tenant_id=tenant_uuid,
        user_id=user_id,
        first_name="",
        last_name="",
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return profile


@router.get("/me", response_model=APIResponse[ProfileRead])
async def get_my_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    try:
        profile = await _get_or_create_own_profile(db, current_user, tenant_slug)
        return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("get_my_profile_failed", error=str(exc), error_type=type(exc).__name__, exc_info=True)
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}")


@router.patch("/me", response_model=APIResponse[ProfileRead])
async def patch_my_profile(
    payload: ProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    profile = await _get_or_create_own_profile(db, current_user, tenant_slug)
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(profile, key, value)
    profile.completeness_score = compute_profile_completeness(profile)
    await db.flush()
    await db.refresh(profile)
    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


@router.post("/me/photos", response_model=APIResponse[ProfileRead])
async def add_my_photo(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Append a photo {url, key, is_primary?} to the current user's profile."""
    url = payload.get("url")
    key = payload.get("key")
    if not url or not key:
        raise HTTPException(status_code=400, detail="url and key required")
    profile = await _get_or_create_own_profile(db, current_user, tenant_slug)
    photos = list(profile.photos or [])
    is_primary = bool(payload.get("is_primary")) or len(photos) == 0
    if is_primary:
        for p in photos:
            p["is_primary"] = False
    photos.append({"url": url, "key": key, "is_primary": is_primary})
    profile.photos = photos
    profile.completeness_score = compute_profile_completeness(profile)
    await db.flush()
    await db.refresh(profile)
    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


@router.delete("/me/photos", response_model=APIResponse[ProfileRead])
async def delete_my_photo(
    key: str = Query(..., description="Cloudinary public_id of the photo to remove"),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    from app.services.storage import delete_photo
    profile = await _get_or_create_own_profile(db, current_user, tenant_slug)
    photos = [p for p in (profile.photos or []) if p.get("key") != key]
    if photos and not any(p.get("is_primary") for p in photos):
        photos[0]["is_primary"] = True
    profile.photos = photos
    profile.completeness_score = compute_profile_completeness(profile)
    try:
        delete_photo(key)
    except Exception as exc:
        logger.warning("cloudinary_delete_soft_fail", error=str(exc), key=key)
    await db.flush()
    await db.refresh(profile)
    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


@router.post("/me/photos/primary", response_model=APIResponse[ProfileRead])
async def set_primary_photo(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    key = payload.get("key")
    if not key:
        raise HTTPException(status_code=400, detail="key required")
    profile = await _get_or_create_own_profile(db, current_user, tenant_slug)
    photos = list(profile.photos or [])
    found = False
    for p in photos:
        is_match = p.get("key") == key
        p["is_primary"] = is_match
        if is_match:
            found = True
    if not found:
        raise HTTPException(status_code=404, detail="Photo not found")
    profile.photos = photos
    await db.flush()
    await db.refresh(profile)
    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


def _is_profile_complete(p: UserProfile) -> tuple[bool, list[str]]:
    """Require every profile field to be filled before submission."""
    missing: list[str] = []

    def need(cond: bool, name: str) -> None:
        if not cond:
            missing.append(name)

    # Basic identity
    need(bool(p.first_name and p.first_name.strip()), "first_name")
    need(bool(p.last_name and p.last_name.strip()), "last_name")
    need(p.date_of_birth is not None, "date_of_birth")
    need(p.gender is not None, "gender")
    need(p.marital_status is not None, "marital_status")

    # Location
    need(bool(p.city and p.city.strip()), "city")
    need(bool(p.state and p.state.strip()), "state")
    need(bool(p.country and p.country.strip()), "country")

    # Religious / community
    need(p.religion is not None, "religion")
    need(bool(p.caste and p.caste.strip()), "caste")
    need(bool(p.mother_tongue and p.mother_tongue.strip()), "mother_tongue")
    need(bool(p.languages and len(p.languages) > 0), "languages")

    # Physical
    need(p.height_cm is not None, "height_cm")
    need(p.weight_kg is not None, "weight_kg")
    need(bool(p.complexion and p.complexion.strip()), "complexion")
    need(bool(p.body_type and p.body_type.strip()), "body_type")

    # Education & career
    need(bool(p.education_level and p.education_level.strip()), "education_level")
    need(bool(p.education_field and p.education_field.strip()), "education_field")
    need(bool(p.college and p.college.strip()), "college")
    need(bool(p.occupation and p.occupation.strip()), "occupation")
    need(bool(p.employer and p.employer.strip()), "employer")
    need(p.annual_income_inr is not None, "annual_income_inr")

    # Bio
    need(bool(p.bio and len(p.bio.strip()) >= 20), "bio")
    need(bool(p.about_family and p.about_family.strip()), "about_family")

    # Media
    need(bool(p.photos and len(p.photos) > 0), "photos")

    # Partner preferences + family details (non-empty JSON)
    need(bool(p.partner_prefs and len(p.partner_prefs) > 0), "partner_prefs")
    need(bool(p.family_details and len(p.family_details) > 0), "family_details")

    # Kundali
    need(bool(p.birth_time and p.birth_time.strip()), "birth_time")
    need(bool(p.birth_place and p.birth_place.strip()), "birth_place")
    need(p.is_manglik is not None, "is_manglik")

    # NRI
    need(bool(p.visa_status and p.visa_status.strip()), "visa_status")

    return (len(missing) == 0, missing)


@router.post("/me/submit", response_model=APIResponse[ProfileRead])
async def submit_profile_for_review(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    profile = await _get_or_create_own_profile(db, current_user, tenant_slug)
    if profile.verification_status == "approved":
        return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))
    complete, missing = _is_profile_complete(profile)
    if not complete:
        raise HTTPException(status_code=400, detail={"message": "Profile incomplete", "missing": missing})
    profile.verification_status = "submitted"
    profile.rejection_reason = None
    profile.submitted_at = datetime.utcnow()
    await db.flush()
    await db.refresh(profile)
    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


@router.get("/admin/verifications", response_model=APIResponse[list[dict]])
async def admin_list_verifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    status_filter: str = Query(default="submitted", description="submitted | approved | rejected | all"),
):
    roles = current_user.get("roles", []) or current_user.get("https://bandhan.in/roles", [])
    if "admin" not in roles and "super_admin" not in roles:
        raise HTTPException(status_code=403, detail="Admin required")
    q = select(UserProfile).where(UserProfile.deleted_at.is_(None))
    if status_filter != "all":
        q = q.where(UserProfile.verification_status == status_filter)
    q = q.order_by(UserProfile.submitted_at.desc().nullslast())
    res = await db.execute(q)
    profiles = res.scalars().all()
    items = [ProfileRead.model_validate(p, from_attributes=True).model_dump(mode="json") for p in profiles]
    return APIResponse(success=True, data=items)


@router.post("/admin/verifications/{user_id}/approve", response_model=APIResponse[ProfileRead])
async def admin_approve(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    roles = current_user.get("roles", []) or current_user.get("https://bandhan.in/roles", [])
    if "admin" not in roles and "super_admin" not in roles:
        raise HTTPException(status_code=403, detail="Admin required")
    res = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile.verification_status = "approved"
    profile.rejection_reason = None
    profile.reviewed_at = datetime.utcnow()
    await db.flush()
    await db.refresh(profile)
    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


@router.post("/admin/verifications/{user_id}/request-info", response_model=APIResponse[ProfileRead])
async def admin_request_info(
    user_id: uuid.UUID,
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    roles = current_user.get("roles", []) or current_user.get("https://bandhan.in/roles", [])
    if "admin" not in roles and "super_admin" not in roles:
        raise HTTPException(status_code=403, detail="Admin required")
    note = (payload or {}).get("note", "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="note required")
    res = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    # Bounce back to draft so the user can edit + resubmit
    profile.verification_status = "draft"
    profile.rejection_reason = f"More info needed: {note}"
    profile.reviewed_at = datetime.utcnow()
    await db.flush()
    await db.refresh(profile)
    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


@router.post("/admin/verifications/{user_id}/reject", response_model=APIResponse[ProfileRead])
async def admin_reject(
    user_id: uuid.UUID,
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    roles = current_user.get("roles", []) or current_user.get("https://bandhan.in/roles", [])
    if "admin" not in roles and "super_admin" not in roles:
        raise HTTPException(status_code=403, detail="Admin required")
    reason = (payload or {}).get("reason", "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="reason required")
    res = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile.verification_status = "rejected"
    profile.rejection_reason = reason
    profile.reviewed_at = datetime.utcnow()
    await db.flush()
    await db.refresh(profile)
    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


@router.get("/{user_id}", response_model=APIResponse[ProfileRead])
async def get_profile(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    result = await db.execute(
        select(UserProfile).where(
            UserProfile.user_id == user_id,
            UserProfile.deleted_at.is_(None),
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        # Auto-create an empty profile for authenticated users fetching their own profile
        # This prevents 404 on first app load before onboarding completes
        from sqlalchemy import text as sa_text
        tenant_result = await db.execute(
            sa_text("SELECT id FROM tenants WHERE slug = :slug LIMIT 1"),
            {"slug": tenant_slug}
        )
        tenant_row = tenant_result.fetchone()
        tenant_uuid = tenant_row[0] if tenant_row else None

        # Only auto-create if the requesting user is fetching their own profile
        requesting_user_id = str(current_user.get("sub", ""))
        if requesting_user_id != str(user_id):
            raise HTTPException(status_code=404, detail="Profile not found")

        profile = UserProfile(
            id=uuid.uuid4(),
            tenant_id=tenant_uuid,
            user_id=user_id,
            first_name="",
            last_name="",
        )
        db.add(profile)
        await db.flush()
        await db.refresh(profile)
        logger.info("profile_auto_created_on_get", user_id=str(user_id))

    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


@router.put("/{user_id}", response_model=APIResponse[ProfileRead])
async def update_profile(
    user_id: uuid.UUID,
    payload: ProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    result = await db.execute(
        select(UserProfile).where(
            UserProfile.user_id == user_id,
            UserProfile.deleted_at.is_(None),
        )
    )
    profile = result.scalar_one_or_none()

    if not profile:
        # Auto-create profile for new users (upsert behaviour)
        from sqlalchemy import text as sa_text
        tenant_result = await db.execute(
            sa_text("SELECT id FROM tenants WHERE slug = 'bandhan' LIMIT 1")
        )
        tenant_row = tenant_result.fetchone()
        tenant_uuid = tenant_row[0] if tenant_row else None

        # Ensure user exists in users table (required for FK)
        from sqlalchemy import text as sa_text2
        user_exists = await db.execute(
            sa_text2("SELECT id FROM users WHERE id = :uid LIMIT 1"),
            {"uid": str(user_id)}
        )
        if not user_exists.fetchone():
            # Create user record if missing
            await db.execute(
                sa_text2("""
                    INSERT INTO users (id, tenant_id, is_phone_verified, created_at, updated_at)
                    VALUES (:uid, :tid, true, NOW(), NOW())
                    ON CONFLICT (id) DO NOTHING
                """),
                {"uid": str(user_id), "tid": str(tenant_uuid)}
            )
            await db.flush()

        profile = UserProfile(
            id=uuid.uuid4(),
            tenant_id=tenant_uuid,
            user_id=user_id,
            first_name="",
            last_name="",
        )
        db.add(profile)
        await db.flush()
        logger.info("profile_auto_created", user_id=str(user_id))

    update_data = payload.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(profile, key, value)

    profile.completeness_score = compute_profile_completeness(profile)
    await db.flush()
    await db.refresh(profile)

    logger.info("profile_updated", user_id=str(user_id))
    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


@router.post("/photos/upload-url", response_model=APIResponse[dict])
async def get_photo_upload_url(
    content_type: str = Query(..., pattern=r"^image/(jpeg|jpg|png|webp)$"),
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Returns signed Cloudinary upload params for direct client photo upload."""
    ext_map = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }
    ext = ext_map.get(content_type, "jpg")
    user_id = current_user.get("sub", "unknown")

    result = generate_photo_upload_signature(
        tenant_slug=tenant_slug,
        user_id=user_id,
        file_extension=ext,
    )
    return APIResponse(success=True, data=result)


@router.post("/voice-note/upload-url", response_model=APIResponse[dict])
async def get_voice_upload_url(
    content_type: str = Query(..., pattern=r"^audio/(mpeg|ogg|webm|mp4)$"),
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    user_id = current_user.get("sub", "unknown")
    ext_map = {"audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/webm": "webm", "audio/mp4": "m4a"}
    result = generate_upload_url(
        tenant_slug=tenant_slug,
        user_id=user_id,
        media_type="voice",
        content_type=content_type,
        file_extension=ext_map.get(content_type, "mp3"),
    )
    return APIResponse(success=True, data=result)
