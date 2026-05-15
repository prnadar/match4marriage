"""
Membership-number service.

Mints human-friendly identifiers like ``M4M202600001`` and assigns them
to users when they finish onboarding. Numbers are unique per tenant, with
a separate counter per year so the prefix carries useful "when joined"
context.

Concurrency: PostgreSQL transaction-level advisory locks scoped to
``(tenant_id, year)`` serialise concurrent assignments without blocking
other tenants or other years. The lock is released automatically when
the transaction ends.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.user import User

logger = get_logger(__name__)

_PREFIX = "M4M"


def _advisory_lock_key(tenant_id: str, year: int) -> int:
    """Stable 31-bit signed-int key for pg_advisory_xact_lock."""
    # Postgres advisory locks take a bigint; we squash to 31 bits to stay
    # well inside that range while preserving good distribution.
    return hash((str(tenant_id), int(year))) % (2**31 - 1)


async def assign_membership_number(
    db: AsyncSession,
    user: User,
    *,
    year: Optional[int] = None,
) -> str:
    """
    Mint and assign a membership number to ``user`` if they don't already
    have one. Returns the final number (existing or newly-minted).

    Caller is responsible for committing the surrounding transaction.
    """
    if user.membership_number:
        return user.membership_number

    issue_year = year or datetime.utcnow().year
    # No separators between segments — the prefix is just M4M + 4-digit year.
    prefix = f"{_PREFIX}{issue_year}"
    lock_key = _advisory_lock_key(str(user.tenant_id), issue_year)

    # Serialise concurrent assignments within the same tenant + year.
    await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": lock_key})

    # Find the highest existing sequence for this tenant + year. We strip
    # the prefix and cast the suffix to int — the unique index on
    # (tenant_id, membership_number) also protects us against duplicates
    # if this query somehow misses.
    row = await db.execute(
        text(
            """
            SELECT COALESCE(
              MAX(CAST(SUBSTRING(membership_number FROM :start_pos) AS INTEGER)),
              0
            )
            FROM users
            WHERE tenant_id = :tid
              AND membership_number LIKE :prefix
            """
        ),
        {
            "tid": user.tenant_id,
            "prefix": f"{prefix}%",
            # SUBSTRING is 1-indexed in Postgres. ``len(prefix) + 1`` is
            # the position of the first digit of the sequence.
            "start_pos": len(prefix) + 1,
        },
    )
    max_seq = row.scalar() or 0
    next_seq = int(max_seq) + 1
    number = f"{prefix}{next_seq:05d}"

    user.membership_number = number
    db.add(user)
    await db.flush()

    logger.info(
        "membership.assigned",
        extra={"user_id": str(user.id), "membership_number": number},
    )
    return number
