"""Shared seeding helpers for the admin router tests (not a test module)."""
import uuid
from datetime import date

from sqlalchemy import select

from app.core.security import get_current_user
from app.main import app
from app.models.tenant import Tenant
from app.models.user import User, UserProfile

HEADERS = {"X-Tenant-ID": "match4marriage"}
ADMIN_EMAIL = "staff@example.com"


async def tenant(db, slug: str = "match4marriage") -> Tenant:
    t = (await db.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none()
    if t is None:
        t = Tenant(id=uuid.uuid4(), slug=slug, name=slug.title())
        db.add(t)
        await db.flush()
    return t


async def member(db, t: Tenant, *, first="Asha", last="Patel", dob: date | None = date(1992, 5, 17), profile=True, **user_kw) -> User:
    u = User(id=uuid.uuid4(), tenant_id=t.id, email=f"{uuid.uuid4().hex[:10]}@example.com", firebase_uids=[], **user_kw)
    db.add(u)
    await db.flush()
    if profile:
        db.add(UserProfile(
            id=uuid.uuid4(), tenant_id=t.id, user_id=u.id, first_name=first, last_name=last,
            date_of_birth=dob, city="Lodon", country="United Kingdom",
        ))
        await db.flush()
    return u


def as_admin(admin_id: uuid.UUID | None = None, roles=("admin",)) -> dict:
    claims = {"sub": str(admin_id or uuid.uuid4()), "email": ADMIN_EMAIL, "roles": list(roles)}
    app.dependency_overrides[get_current_user] = lambda: claims
    return claims


def as_member(user: User) -> None:
    app.dependency_overrides[get_current_user] = lambda: {"sub": str(user.id), "email": user.email}
