"""
Membership-number service.

Mints human-friendly identifiers like ``M4M2026001`` (prefix + 4-digit year
+ a per-year sequence, zero-padded to 3 digits) and assigns them to users
when they finish onboarding. Numbers are unique per tenant, with a separate
counter per year so the prefix carries useful "when joined" context. The
sequence grows past 3 digits naturally once a year exceeds 999 members.

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
            # NB: use substr(text, int), NOT `SUBSTRING(x FROM :p)`. With the
            # `FROM` form Postgres infers the bind param as the regex-PATTERN
            # variant (text) and asyncpg then rejects our integer start with
            # "expected str, got int" — which silently failed every assignment.
            # substr()'s 2nd arg is unambiguously an integer.
            """
            SELECT COALESCE(
              MAX(CAST(substr(membership_number, :start_pos) AS INTEGER)),
              0
            )
            FROM users
            WHERE tenant_id = :tid
              AND membership_number LIKE :prefix
              -- Only rows whose suffix is purely numeric. A legacy or
              -- hand-edited number (e.g. "M4M2026-VIP") would otherwise make
              -- CAST(substr(...) AS INTEGER) throw, abort the transaction, and
              -- break the profile load that triggered the self-heal.
              AND membership_number ~ :numeric_re
            """
        ),
        {
            "tid": user.tenant_id,
            "prefix": f"{prefix}%",
            "numeric_re": f"^{prefix}[0-9]+$",
            # SUBSTRING is 1-indexed in Postgres. ``len(prefix) + 1`` is
            # the position of the first digit of the sequence.
            "start_pos": len(prefix) + 1,
        },
    )
    max_seq = row.scalar() or 0
    next_seq = int(max_seq) + 1
    # 3-digit zero-pad → M4M2026001, M4M2026002, … (grows to 4+ digits past 999).
    number = f"{prefix}{next_seq:03d}"

    user.membership_number = number
    db.add(user)
    await db.flush()

    logger.info(
        "membership.assigned",
        extra={"user_id": str(user.id), "membership_number": number},
    )
    return number
