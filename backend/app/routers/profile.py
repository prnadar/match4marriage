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
from sqlalchemy import func, select, text as sa_text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.rate_limit import BROWSE_LIMIT, limiter
from app.core.security import get_current_user, has_admin_role
from app.core.tenancy import get_current_tenant_slug
from app.models.user import MaritalStatus, Religion, User, UserProfile
from app.models.verification import Verification, VerificationStatus, VerificationType
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.user import ProfileCard, ProfileCreate, ProfileRead, ProfileUpdate
from app.services.storage import generate_photo_upload_signature, generate_upload_url
from app.services.trust_score import compute_profile_completeness, compute_trust_score

router = APIRouter(prefix="/profile", tags=["profile"])
logger = get_logger(__name__)

# JSON columns that must be merged (not replaced) on PATCH.
_MERGE_JSON_KEYS = {"partner_prefs", "family_details", "kundali_data"}

# Module-level flag so we only run the schema guard once per cold-boot.
_schema_guard_ran = False

# DDL statements run at cold-boot on a fresh AUTOCOMMIT connection off the
# engine — NOT on the request-scoped session. A failure here cannot poison an
# active request transaction. Every statement is individually idempotent.
_SCHEMA_GUARD_DDL = [
    # users: drop legacy NOT NULLs and add missing defaults
    "ALTER TABLE users ALTER COLUMN phone DROP NOT NULL",
    "ALTER TABLE users ALTER COLUMN email DROP NOT NULL",
    "ALTER TABLE users ALTER COLUMN trust_score SET DEFAULT 0",
    "ALTER TABLE users ALTER COLUMN subscription_tier SET DEFAULT 'free'",
    "ALTER TABLE users ALTER COLUMN interests_remaining SET DEFAULT 10",
    "ALTER TABLE users ALTER COLUMN contact_unlocks_remaining SET DEFAULT 0",
    "ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true",
    "ALTER TABLE users ALTER COLUMN is_phone_verified SET DEFAULT false",
    "ALTER TABLE users ALTER COLUMN is_email_verified SET DEFAULT false",
    "ALTER TABLE users ALTER COLUMN is_profile_complete SET DEFAULT false",
    # firebase_uids column (added as part of identity unification)
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uids JSONB NOT NULL DEFAULT '[]'::jsonb",
    # profiles: verification + new fields
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'draft'",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_rejection_reason TEXT",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_kg SMALLINT",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS complexion VARCHAR(50)",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_type VARCHAR(50)",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education_field VARCHAR(200)",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS college VARCHAR(200)",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employer VARCHAR(200)",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sub_caste VARCHAR(200)",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS about_family TEXT",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kundali_data JSONB NOT NULL DEFAULT '{}'::jsonb",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_time VARCHAR(10)",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_place VARCHAR(200)",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_manglik BOOLEAN",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intro_videos JSONB NOT NULL DEFAULT '[]'::jsonb",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS voice_note_key VARCHAR(500)",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS visa_status VARCHAR(100)",
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS willing_to_relocate BOOLEAN NOT NULL DEFAULT FALSE",
]

# ALTER TYPE ADD VALUE cannot run inside a transaction block, so it runs
# separately on an autocommit connection.
_SCHEMA_GUARD_ENUM_ADDITIONS = [
    ("maritalstatus", "awaiting_divorce"),
]


async def _run_schema_guard_once(db: AsyncSession) -> None:
    """
    Idempotent schema alignment. Runs once per process, on a dedicated
    AUTOCOMMIT connection off the engine — NOT on `db` — so a DDL error
    cannot poison the caller's request transaction.

    Coordination: serialized cross-process via a Postgres advisory lock so
    concurrent first-requests from different lambda instances don't race for
    AccessExclusiveLock on the same table (which deadlocks with concurrent
    SELECTs holding AccessShareLock — observed on Vercel).

    The `db` parameter is kept for API compatibility but unused.
    """
    global _schema_guard_ran
    if _schema_guard_ran:
        return
    # Mark intent BEFORE we attempt the lock so concurrent in-process requests
    # within this lambda don't all stack up at the lock.
    _schema_guard_ran = True

    from app.core.database import engine

    # App-wide advisory lock key — distinct from the boot-DDL key in main.py.
    GUARD_LOCK_KEY = 7427261984412719105

    try:
        async with engine.connect() as conn:
            await conn.execution_options(isolation_level="AUTOCOMMIT")
            try:
                got_lock = (await conn.execute(
                    sa_text("SELECT pg_try_advisory_lock(:k)"),
                    {"k": GUARD_LOCK_KEY},
                )).scalar()
            except Exception as e:
                logger.warning("schema_guard_lock_failed", error=str(e))
                got_lock = False

            if not got_lock:
                # Another instance is doing the work — let it finish; our
                # _schema_guard_ran flag is already set so we won't retry.
                logger.info("schema_guard_skipped_another_instance_holds_lock")
                return

            try:
                for s in _SCHEMA_GUARD_DDL:
                    try:
                        await conn.execute(sa_text(s))
                    except Exception as e:
                        logger.warning("schema_guard_stmt_failed", stmt=s, error=str(e))
                for type_name, value in _SCHEMA_GUARD_ENUM_ADDITIONS:
                    try:
                        await conn.execute(sa_text(
                            f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{value}'"
                        ))
                    except Exception as e:
                        logger.warning("schema_guard_enum_failed", type_name=type_name, value=value, error=str(e))
            finally:
                # Always release the advisory lock so other lambdas can proceed.
                try:
                    await conn.execute(
                        sa_text("SELECT pg_advisory_unlock(:k)"),
                        {"k": GUARD_LOCK_KEY},
                    )
                except Exception as e:
                    logger.warning("schema_guard_unlock_failed", error=str(e))
    except Exception as e:
        logger.error("schema_guard_connect_failed", error=str(e))


@router.get("/trust-score", response_model=APIResponse[dict])
async def get_trust_score(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Returns the current user's trust score (0-100) and a per-signal breakdown."""
    result = await compute_trust_score(current_user, db)
    return APIResponse(success=True, data=result)


@router.get("/browse", response_model=PaginatedResponse[ProfileCard])
@limiter.limit(BROWSE_LIMIT)
async def browse_profiles(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    min_age: int | None = Query(default=None, ge=18, le=100),
    max_age: int | None = Query(default=None, ge=18, le=100),
    religion: Religion | None = Query(default=None),
    location: str | None = Query(default=None),
    education: str | None = Query(default=None),
    marital_status: MaritalStatus | None = Query(default=None),
    has_photo: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
):
    tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    raw_sub = current_user.get("sub") or current_user.get("user_id", "")
    try:
        caller_id = uuid.UUID(str(raw_sub))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="Invalid user identity in token")

    offset = (page - 1) * limit
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

    today = date.today()
    if min_age is not None:
        max_dob = date(today.year - min_age, today.month, today.day)
        base_q = base_q.where(UserProfile.date_of_birth <= max_dob)
    if max_age is not None:
        min_dob = date(today.year - max_age - 1, today.month, today.day)
        base_q = base_q.where(UserProfile.date_of_birth >= min_dob)

    if religion is not None:
        base_q = base_q.where(UserProfile.religion == religion)
    if marital_status is not None:
        base_q = base_q.where(UserProfile.marital_status == marital_status)

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

    if has_photo is True:
        base_q = base_q.where(sa_text("jsonb_array_length(profiles.photos::jsonb) > 0"))
    elif has_photo is False:
        base_q = base_q.where(sa_text("jsonb_array_length(profiles.photos::jsonb) = 0"))

    count_q = select(func.count()).select_from(base_q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

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

    logger.info("profiles_browsed", caller_id=str(caller_id), tenant=tenant_slug, total=total, page=page)
    return PaginatedResponse.create(items=cards, total=total, page=page, limit=limit)


async def _resolve_tenant_uuid(db: AsyncSession, tenant_slug: str) -> uuid.UUID | None:
    """Look up a tenant UUID; auto-provision the row if missing (idempotent)."""
    row = (await db.execute(
        sa_text("SELECT id FROM tenants WHERE slug = :slug LIMIT 1"), {"slug": tenant_slug}
    )).fetchone()
    if row:
        return row[0]

    # Auto-provision. ON CONFLICT makes this safe under concurrent requests.
    try:
        await db.execute(
            sa_text(
                "INSERT INTO tenants (id, slug, name, branding, features, plan, max_users, is_active, created_at, updated_at) "
                "VALUES (gen_random_uuid(), :slug, :name, '{}'::jsonb, '{}'::jsonb, 'starter', 10000, true, NOW(), NOW()) "
                "ON CONFLICT (slug) DO NOTHING"
            ),
            {"slug": tenant_slug, "name": tenant_slug.capitalize()},
        )
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.warning("tenant_autoprovision_failed", error=str(e), slug=tenant_slug)

    row = (await db.execute(
        sa_text("SELECT id FROM tenants WHERE slug = :slug LIMIT 1"), {"slug": tenant_slug}
    )).fetchone()
    return row[0] if row else None


async def _get_or_create_own_profile(
    db: AsyncSession,
    current_user: dict,
    tenant_slug: str,
) -> UserProfile:
    """
    Idempotent: finds the caller's profile, or creates User + UserProfile rows
    on first request. Safe under concurrent requests (advisory lock + commit).
    """
    await _run_schema_guard_once(db)
    user_id = uuid.UUID(current_user["sub"])
    firebase_uid: str | None = current_user.get("firebase_uid")

    # Fast path: profile exists
    result = await db.execute(
        select(UserProfile).where(
            UserProfile.user_id == user_id,
            UserProfile.deleted_at.is_(None),
        )
    )
    profile = result.scalar_one_or_none()
    if profile:
        return profile

    # Serialize creation across concurrent requests with a Postgres advisory
    # lock keyed on the user_id. Ignored on SQLite (tests).
    try:
        lock_key = int(user_id.int & ((1 << 63) - 1))
        await db.execute(sa_text("SELECT pg_advisory_xact_lock(:k)"), {"k": lock_key})
    except Exception:
        pass

    # Re-check after acquiring the lock
    result = await db.execute(
        select(UserProfile).where(
            UserProfile.user_id == user_id,
            UserProfile.deleted_at.is_(None),
        )
    )
    profile = result.scalar_one_or_none()
    if profile:
        return profile

    tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=500, detail=f"Could not provision tenant {tenant_slug!r}")

    # Upsert User row
    existing_user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not existing_user:
        phone = current_user.get("phone") or current_user.get("phone_number")
        email = current_user.get("email")
        uids = [firebase_uid] if firebase_uid else []
        new_user = User(
            id=user_id,
            tenant_id=tenant_uuid,
            phone=phone,
            email=email,
            firebase_uids=uids,
            is_phone_verified=bool(phone),
            is_email_verified=bool(current_user.get("email_verified")),
        )
        # Nest in a SAVEPOINT so race-condition retries don't blow away the
        # outer transaction (and unrelated linking work done in get_current_user).
        try:
            async with db.begin_nested():
                db.add(new_user)
                await db.flush()
        except IntegrityError:
            existing_user = (
                await db.execute(select(User).where(User.id == user_id))
            ).scalar_one_or_none()
    else:
        # Keep firebase_uids and verification flags fresh
        changed = False
        if firebase_uid and firebase_uid not in (existing_user.firebase_uids or []):
            existing_user.firebase_uids = [*(existing_user.firebase_uids or []), firebase_uid]
            changed = True
        if current_user.get("email_verified") and not existing_user.is_email_verified:
            existing_user.is_email_verified = True
            changed = True
        if current_user.get("phone") and not existing_user.is_phone_verified:
            existing_user.is_phone_verified = True
            changed = True
        if changed:
            await db.flush()

    # Create the empty profile (nested savepoint to survive unique races).
    profile = UserProfile(
        id=uuid.uuid4(),
        tenant_id=tenant_uuid,
        user_id=user_id,
        first_name="",
        last_name="",
    )
    try:
        async with db.begin_nested():
            db.add(profile)
            await db.flush()
    except IntegrityError:
        profile = (await db.execute(
            select(UserProfile).where(UserProfile.user_id == user_id, UserProfile.deleted_at.is_(None))
        )).scalar_one_or_none()
        if profile is None:
            raise
    # Commit so the new row is durable and visible to concurrent requests
    # that are blocked on the advisory lock.
    await db.commit()
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id, UserProfile.deleted_at.is_(None))
    )
    return result.scalar_one()


@router.get("/me", response_model=APIResponse[ProfileRead])
async def get_my_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    try:
        profile = await _get_or_create_own_profile(db, current_user, tenant_slug)
        # Refresh email verification from Firebase claims (fix #9)
        await _sync_verification_flags(db, current_user)
        return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("get_my_profile_failed", error=str(exc), error_type=type(exc).__name__, exc_info=True)
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}")


async def _sync_verification_flags(db: AsyncSession, current_user: dict) -> None:
    """Refresh is_email_verified / is_phone_verified from current Firebase claims."""
    try:
        user_id = uuid.UUID(current_user["sub"])
    except (KeyError, ValueError):
        return
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        return
    changed = False
    if current_user.get("email_verified") and not user.is_email_verified:
        user.is_email_verified = True
        changed = True
    if current_user.get("phone") and not user.is_phone_verified:
        user.is_phone_verified = True
        changed = True
    if changed:
        await db.flush()


def _merge_json(existing: dict | None, incoming: dict | None) -> dict:
    """Shallow-merge two JSON dicts. Keys with None in incoming are removed."""
    merged = dict(existing or {})
    if not incoming:
        return merged
    for k, v in incoming.items():
        if v is None:
            merged.pop(k, None)
        else:
            merged[k] = v
    return merged


def _apply_profile_patch(profile: UserProfile, payload: dict) -> None:
    """Apply a partial update. JSON fields are merged, scalars replaced."""
    for key, value in payload.items():
        if key in _MERGE_JSON_KEYS and isinstance(value, dict):
            current = getattr(profile, key, None) or {}
            setattr(profile, key, _merge_json(current, value))
        else:
            setattr(profile, key, value)


@router.patch("/me", response_model=APIResponse[ProfileRead])
async def patch_my_profile(
    payload: ProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    request: Request,
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    profile = await _get_or_create_own_profile(db, current_user, tenant_slug)

    # Optimistic locking via If-Match header (value = current version). Optional.
    if_match = request.headers.get("If-Match") or request.headers.get("if-match")
    current_version = getattr(profile, "version", 0) or 0
    if if_match:
        try:
            client_version = int(if_match.strip('"'))
        except ValueError:
            client_version = -1
        if client_version != current_version:
            raise HTTPException(
                status_code=status.HTTP_412_PRECONDITION_FAILED,
                detail={
                    "message": "Profile was modified by another session",
                    "current_version": current_version,
                },
            )

    update_data = payload.model_dump(exclude_unset=True)
    _apply_profile_patch(profile, update_data)
    profile.completeness_score = compute_profile_completeness(profile)
    try:
        setattr(profile, "version", current_version + 1)
    except Exception:
        pass
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


@router.put("/me/photos/reorder", response_model=APIResponse[ProfileRead])
async def reorder_my_photos(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Reorder the user's photos. Body: {"keys": ["public_id_1", "public_id_2", ...]}
    The first key in the list becomes the primary photo. Unknown keys are
    ignored; missing keys are appended to the tail in their existing order.
    """
    keys = payload.get("keys")
    if not isinstance(keys, list) or not all(isinstance(k, str) for k in keys):
        raise HTTPException(status_code=400, detail="keys must be a list of strings")
    profile = await _get_or_create_own_profile(db, current_user, tenant_slug)
    existing = list(profile.photos or [])
    by_key: dict[str, dict] = {p.get("key"): p for p in existing if p.get("key")}

    seen: set[str] = set()
    ordered: list[dict] = []
    for k in keys:
        ph = by_key.get(k)
        if ph is None or k in seen:
            continue
        seen.add(k)
        ordered.append(ph)
    # Append any photos the client didn't include (defensive against drift).
    for p in existing:
        k = p.get("key")
        if k and k not in seen:
            ordered.append(p)
            seen.add(k)

    # First photo is the new primary.
    for i, p in enumerate(ordered):
        p["is_primary"] = (i == 0)

    profile.photos = ordered
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
    """
    Require all *core* fields before submission.

    Alignment with the frontend (match4marriage/frontend/app/(app)/profile/me/page.tsx):
    - Fields not required during draft: `about_family`, `is_manglik`, `visa_status`,
      `birth_time`, `birth_place` (kept optional for v1 launch).
    - `bio` is required but only min 10 chars (matches the onboarding bio hint).
    - `partner_prefs` / `family_details` must be populated with at least 3 keys each.
    """
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
    need(bool(p.country and p.country.strip()), "country")

    # Community
    need(p.religion is not None, "religion")
    need(bool(p.caste and p.caste.strip()), "caste")
    need(bool(p.mother_tongue and p.mother_tongue.strip()), "mother_tongue")

    # Physical
    need(p.height_cm is not None, "height_cm")

    # Education & career
    need(bool(p.education_level and p.education_level.strip()), "education_level")
    need(bool(p.occupation and p.occupation.strip()), "occupation")

    # Bio
    need(bool(p.bio and len(p.bio.strip()) >= 10), "bio")

    # Media
    need(bool(p.photos and len(p.photos) > 0), "photos")

    # Partner prefs + family details — at least 3 meaningful keys each
    def _nonempty_keys(d: dict | None) -> int:
        if not d:
            return 0
        return sum(1 for v in d.values() if v not in (None, "", [], {}))

    need(_nonempty_keys(p.partner_prefs) >= 3, "partner_prefs")
    need(_nonempty_keys(p.family_details) >= 3, "family_details")

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
    # Preserve prior rejection reason as `last_rejection_reason` so admin keeps context
    prior = profile.rejection_reason
    if prior:
        try:
            setattr(profile, "last_rejection_reason", prior)
        except Exception:
            pass
    profile.verification_status = "submitted"
    profile.rejection_reason = None
    profile.submitted_at = datetime.utcnow()
    await db.flush()
    await db.refresh(profile)
    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


# ── Completion strip data ────────────────────────────────────────────────────

# Friendly labels + the tab each missing field belongs to. Keep keys aligned
# with `_is_profile_complete` above so the strip stays in sync with the gate.
_FIELD_META: dict[str, dict[str, str]] = {
    "first_name":      {"label": "First name",        "tab": "general"},
    "last_name":       {"label": "Last name",         "tab": "general"},
    "date_of_birth":   {"label": "Date of birth",     "tab": "general"},
    "gender":          {"label": "Gender",            "tab": "general"},
    "marital_status":  {"label": "Marital status",    "tab": "general"},
    "city":            {"label": "City",              "tab": "contact"},
    "country":         {"label": "Country",           "tab": "contact"},
    "religion":        {"label": "Religion",          "tab": "general"},
    "caste":           {"label": "Caste",             "tab": "general"},
    "mother_tongue":   {"label": "Mother tongue",     "tab": "general"},
    "height_cm":       {"label": "Height",            "tab": "general"},
    "education_level": {"label": "Education",         "tab": "education"},
    "occupation":      {"label": "Occupation",        "tab": "education"},
    "bio":             {"label": "About yourself",    "tab": "general"},
    "photos":          {"label": "Profile photos",    "tab": "photos"},
    "partner_prefs":   {"label": "Partner preferences", "tab": "partner"},
    "family_details":  {"label": "Family details",    "tab": "family"},
}


@router.get("/me/completion", response_model=APIResponse[dict])
async def get_my_completion(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Lightweight feed for the profile completion strip:
      - score: current completeness percentage (0-100)
      - status: verification_status of the profile
      - missing: ordered list of missing fields with friendly labels + target tab
      - badges: { email, phone, photo, id } each one of locked|pending|verified
    Reuses _is_profile_complete so the gate and the strip never drift.
    """
    profile = await _get_or_create_own_profile(db, current_user, tenant_slug)
    await _sync_verification_flags(db, current_user)

    user = (await db.execute(
        select(User).where(User.id == profile.user_id)
    )).scalar_one_or_none()

    _, missing_keys = _is_profile_complete(profile)
    missing = [
        {
            "key": k,
            "label": _FIELD_META.get(k, {}).get("label", k.replace("_", " ").title()),
            "tab": _FIELD_META.get(k, {}).get("tab", "general"),
        }
        for k in missing_keys
    ]

    # Badges. "verified" = trusted state. "pending" = data in flight (e.g. an
    # ID verification that's been started but not yet approved). "locked" = no
    # data yet.
    email_state = "verified" if (user and user.is_email_verified) else "locked"
    phone_state = "verified" if (user and user.is_phone_verified) else "locked"
    photo_state = "verified" if (profile.photos and len(profile.photos) > 0) else "locked"

    # ID badge: look at the user's verification rows for any ID-style verification.
    id_state = "locked"
    if user is not None:
        id_rows = (await db.execute(
            select(Verification.status).where(
                Verification.user_id == user.id,
                Verification.verification_type.in_([
                    VerificationType.AADHAAR,
                    VerificationType.PAN,
                    VerificationType.PHOTO_LIVENESS,
                    VerificationType.DIGILOCKER_EDUCATION,
                ]),
            )
        )).scalars().all()
        if any(s == VerificationStatus.VERIFIED for s in id_rows):
            id_state = "verified"
        elif any(s in (VerificationStatus.PENDING, VerificationStatus.IN_REVIEW) for s in id_rows):
            id_state = "pending"

    return APIResponse(success=True, data={
        "score": int(profile.completeness_score or 0),
        "status": profile.verification_status,
        "missing": missing,
        "badges": {
            "email": email_state,
            "phone": phone_state,
            "photo": photo_state,
            "id":    id_state,
        },
    })


# ── Admin endpoints ──────────────────────────────────────────────────────────


def _require_admin(current_user: dict) -> None:
    if not has_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin required")


@router.get("/admin/verifications", response_model=APIResponse[list[dict]])
async def admin_list_verifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    status_filter: str = Query(default="submitted"),
):
    _require_admin(current_user)
    tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    q = select(UserProfile).where(
        UserProfile.tenant_id == tenant_uuid,
        UserProfile.deleted_at.is_(None),
    )
    if status_filter != "all":
        q = q.where(UserProfile.verification_status == status_filter)
    q = q.order_by(UserProfile.submitted_at.desc().nullslast())
    res = await db.execute(q)
    profiles = res.scalars().all()
    items = [ProfileRead.model_validate(p, from_attributes=True).model_dump(mode="json") for p in profiles]
    return APIResponse(success=True, data=items)


async def _admin_load_profile(db: AsyncSession, tenant_uuid: uuid.UUID, user_id: uuid.UUID) -> UserProfile:
    res = await db.execute(
        select(UserProfile).where(
            UserProfile.user_id == user_id,
            UserProfile.tenant_id == tenant_uuid,
            UserProfile.deleted_at.is_(None),
        )
    )
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/admin/verifications/{user_id}/approve", response_model=APIResponse[ProfileRead])
async def admin_approve(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    profile = await _admin_load_profile(db, tenant_uuid, user_id)
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
    _require_admin(current_user)
    tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    note = (payload or {}).get("note", "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="note required")
    profile = await _admin_load_profile(db, tenant_uuid, user_id)
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
    _require_admin(current_user)
    tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    reason = (payload or {}).get("reason", "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="reason required")
    profile = await _admin_load_profile(db, tenant_uuid, user_id)
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
    # If the caller is asking for their own profile, route through the bootstrap path.
    requesting_user_id = str(current_user.get("sub", ""))
    if requesting_user_id == str(user_id):
        profile = await _get_or_create_own_profile(db, current_user, tenant_slug)
        return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))

    tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)
    if tenant_uuid is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    result = await db.execute(
        select(UserProfile).where(
            UserProfile.user_id == user_id,
            UserProfile.tenant_id == tenant_uuid,
            UserProfile.deleted_at.is_(None),
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return APIResponse(success=True, data=ProfileRead.model_validate(profile, from_attributes=True))


@router.put("/{user_id}", response_model=APIResponse[ProfileRead])
async def update_profile(
    user_id: uuid.UUID,
    payload: ProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Legacy PUT — only allowed for the caller's own row. Delegates to PATCH logic."""
    if str(user_id) != str(current_user.get("sub", "")):
        raise HTTPException(status_code=403, detail="Can only update your own profile")

    profile = await _get_or_create_own_profile(db, current_user, tenant_slug)
    update_data = payload.model_dump(exclude_unset=True)
    _apply_profile_patch(profile, update_data)
    profile.completeness_score = compute_profile_completeness(profile)
    try:
        setattr(profile, "version", (getattr(profile, "version", 0) or 0) + 1)
    except Exception:
        pass
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
    ext_map = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp"}
    ext = ext_map.get(content_type, "jpg")
    user_id = current_user.get("sub", "unknown")
    try:
        result = generate_photo_upload_signature(
            tenant_slug=tenant_slug,
            user_id=user_id,
            file_extension=ext,
        )
    except RuntimeError as exc:
        # Cloudinary not configured (or transient auth failure). Return a
        # clean 503 rather than leaking the raw Python error as a 500.
        logger.error("photo_upload_unavailable", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Photo uploads are temporarily unavailable. Please try again later or contact support.",
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
