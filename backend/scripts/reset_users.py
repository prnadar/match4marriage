"""
Wipe all user / profile data so onboarding can be re-tested from a clean
state. Keeps tenants, pricing plans, admin accounts, site settings, mail
templates, SEO settings, and contact-form enquiries intact.

Usage:
    python scripts/reset_users.py --dry-run     # show what would be deleted
    python scripts/reset_users.py --execute     # actually delete

DATABASE_URL is read from backend/.env (load_dotenv).

The script TRUNCATEs in a single transaction with CASCADE so foreign-key
order doesn't matter. If anything fails the transaction rolls back —
either every table is wiped or none of them.
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


# Load the local .env so DATABASE_URL is available when running outside the app.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


# Tables that store per-user data. Order doesn't matter — TRUNCATE ... CASCADE
# follows FK chains automatically, but listing them explicitly makes the
# dry-run output meaningful (per-table counts) and self-documents which
# tables are in scope.
USER_DATA_TABLES = [
    "messages",
    "chat_threads",
    "interests",
    "matches",
    "notifications",
    "personality_scores",
    "reports",
    "verifications",
    "credit_transactions",
    "subscriptions",
    "profiles",
    "users",
]

PRESERVED_TABLES = [
    "tenants",
    "pricing_plans",
    "payment_gateway_configs",
    "site_settings",
    "mail_templates",
    "seo_settings",
    "success_stories",
    "enquiries",
]


def _normalise_url(raw: str) -> str:
    """Make sure SQLAlchemy gets the async driver name."""
    if raw.startswith("postgresql://"):
        return raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    return raw


async def _count(conn, table: str) -> int | None:
    try:
        result = await conn.execute(text(f'SELECT count(*) FROM "{table}"'))
        return int(result.scalar() or 0)
    except Exception as exc:
        print(f"  ! could not count {table}: {exc.__class__.__name__}: {exc}")
        return None


async def main(execute: bool) -> int:
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL is not set (looked in backend/.env).")
        return 2

    # asyncpg can't open Neon when sslmode/channel_binding live in the query
    # string — those are libpq/psycopg keywords. Strip them; asyncpg uses TLS
    # by default to *.neon.tech.
    safe_url = _normalise_url(db_url)
    for noisy in ("sslmode=require", "channel_binding=require", "channel_binding=prefer"):
        safe_url = safe_url.replace(f"&{noisy}", "").replace(f"?{noisy}", "?")
    safe_url = safe_url.replace("?&", "?").rstrip("?")

    print(f"\nConnecting to: {safe_url.split('@', 1)[-1].split('?')[0]}")
    engine = create_async_engine(safe_url, echo=False)

    try:
        async with engine.connect() as conn:
            # 1. Per-table counts before
            print("\n── Tables in scope (will be wiped) ──")
            before: dict[str, int | None] = {}
            for t in USER_DATA_TABLES:
                n = await _count(conn, t)
                before[t] = n
                marker = "—" if n is None else f"{n:>6}"
                print(f"  {marker}  {t}")

            print("\n── Preserved (NOT wiped) ──")
            for t in PRESERVED_TABLES:
                n = await _count(conn, t)
                marker = "—" if n is None else f"{n:>6}"
                print(f"  {marker}  {t}")

            if not execute:
                print("\nDry run only. Re-run with --execute to actually delete.\n")
                return 0

        # 2. TRUNCATE everything in a single CASCADE so FKs follow. Fresh
        #    connection via engine.begin() — the count phase above auto-began
        #    a transaction on the previous connection.
        print("\nExecuting TRUNCATE …")
        quoted = ", ".join(f'"{t}"' for t in USER_DATA_TABLES)
        async with engine.begin() as txn:
            await txn.execute(text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))

        # 3. Per-table counts after (sanity).
        async with engine.connect() as conn2:
            print("\n── After ──")
            for t in USER_DATA_TABLES:
                n = await _count(conn2, t)
                marker = "—" if n is None else f"{n:>6}"
                print(f"  {marker}  {t}")
            print("\nDone.\n")
    finally:
        await engine.dispose()

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="actually delete")
    parser.add_argument("--dry-run", action="store_true", help="show counts only (default)")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(execute=args.execute)))
