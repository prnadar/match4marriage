"""
Remove every member EXCEPT the admin account(s).

Admin accounts are identified by BOOTSTRAP_ADMIN_EMAILS (comma-separated) in
backend/.env. Everything those users own is preserved; all other users and
their data (profiles + per-user child rows) are deleted.

Usage:
    python scripts/remove_non_admin_members.py --dry-run     # inspect only
    python scripts/remove_non_admin_members.py --execute     # actually delete

Strategy:
  * Resolve the admin user-id(s). ABORT if none found (never wipe blindly).
  * Delete all OTHER users. FK constraints referencing users/profiles that are
    ON DELETE CASCADE clean up children automatically; any non-CASCADE FK
    tables are cleaned explicitly first (in dependency order) using the exact
    referencing columns discovered from information_schema (no column guessing).
  * Single transaction: all-or-nothing.
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Dependency order (children → parents) used to sequence explicit deletes for
# any FK that is NOT ON DELETE CASCADE. Mirrors reset_users.py's ordering.
DEP_ORDER = [
    "messages", "chat_threads", "interests", "matches", "notifications",
    "personality_scores", "reports", "verifications", "credit_transactions",
    "subscriptions", "profiles",
]


def _normalise_url(raw: str) -> str:
    if raw.startswith("postgresql://"):
        raw = raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    for noisy in ("sslmode=require", "channel_binding=require", "channel_binding=prefer"):
        raw = raw.replace(f"&{noisy}", "").replace(f"?{noisy}", "?")
    return raw.replace("?&", "?").rstrip("?")


async def main(execute: bool) -> int:
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set (backend/.env).")
        return 2
    admin_emails = [e.strip().lower() for e in (os.getenv("BOOTSTRAP_ADMIN_EMAILS") or "").split(",") if e.strip()]
    if not admin_emails:
        print("ERROR: BOOTSTRAP_ADMIN_EMAILS is empty — refusing to run (can't identify admin).")
        return 2

    engine = create_async_engine(_normalise_url(db_url), echo=False)
    try:
        async with engine.connect() as conn:
            print(f"\nAdmin emails (preserved): {', '.join(admin_emails)}")
            admin_rows = (await conn.execute(
                text("SELECT id, email FROM users WHERE lower(email) = ANY(:e)"),
                {"e": admin_emails},
            )).all()
            admin_ids = [r[0] for r in admin_rows]
            print(f"Admin users found in DB: {len(admin_ids)}")
            for r in admin_rows:
                print(f"  • keep  {r[1]}  ({str(r[0])[:8]}…)")
            if not admin_ids:
                print("\nERROR: no admin user matched in the DB — ABORTING (won't delete everyone).\n")
                return 2

            total_users = (await conn.execute(text("SELECT count(*) FROM users"))).scalar() or 0
            total_profiles = (await conn.execute(text("SELECT count(*) FROM profiles"))).scalar() or 0
            victims = (await conn.execute(
                text("""SELECT id, email, membership_number, created_at
                        FROM users WHERE id <> ALL(:a) ORDER BY created_at"""),
                {"a": admin_ids},
            )).all()
            print(f"\nTotal users: {total_users} | profiles: {total_profiles}")
            print(f"Members to REMOVE: {len(victims)}")
            for v in victims[:60]:
                print(f"  – remove  {v[1] or '(no email)':35s}  {v[2] or '(no member#)':12s}  {v[3]}")
            if len(victims) > 60:
                print(f"  …and {len(victims) - 60} more")

            # FK delete-rule audit for everything referencing users / profiles.
            fk_rows = (await conn.execute(text("""
                SELECT tc.table_name AS child, kcu.column_name AS col,
                       ccu.table_name AS parent, rc.delete_rule
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                JOIN information_schema.referential_constraints rc
                  ON tc.constraint_name = rc.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                  ON rc.unique_constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND ccu.table_name IN ('users','profiles')
            """))).all()
            non_cascade = [(r[0], r[1], r[2]) for r in fk_rows if (r[3] or "").upper() != "CASCADE"]
            print(f"\nFKs referencing users/profiles: {len(fk_rows)} "
                  f"({len(fk_rows) - len(non_cascade)} CASCADE, {len(non_cascade)} non-CASCADE)")
            for c, col, parent in non_cascade:
                print(f"  ! non-cascade: {c}.{col} -> {parent}  (will delete explicitly)")

            if not execute:
                print("\nDry run only. Re-run with --execute to delete the members above.\n")
                return 0
            if not victims:
                print("\nNothing to remove — only the admin remains.\n")
                return 0

        # ── Execute: single transaction, explicit non-cascade deletes first ──
        print("\nExecuting deletion …")
        async with engine.begin() as txn:
            # Explicit deletes for non-cascade FK tables, in dependency order.
            ordered = sorted(
                non_cascade,
                key=lambda x: DEP_ORDER.index(x[0]) if x[0] in DEP_ORDER else 999,
            )
            for child, col, _parent in ordered:
                res = await txn.execute(
                    text(f'DELETE FROM "{child}" WHERE "{col}" IS NOT NULL AND "{col}" <> ALL(:a)'),
                    {"a": admin_ids},
                )
                print(f"  deleted {res.rowcount:>6} rows from {child} (by {col})")
            # Profiles don't reliably cascade from users in this schema — delete
            # the non-admin ones (and any orphans) explicitly so none are left.
            res = await txn.execute(
                text("DELETE FROM profiles WHERE user_id IS NULL OR user_id <> ALL(:a)"),
                {"a": admin_ids},
            )
            print(f"  deleted {res.rowcount:>6} profiles")
            # Finally the users themselves.
            res = await txn.execute(
                text("DELETE FROM users WHERE id <> ALL(:a)"), {"a": admin_ids}
            )
            print(f"  deleted {res.rowcount:>6} users")

        async with engine.connect() as c2:
            u = (await c2.execute(text("SELECT count(*) FROM users"))).scalar()
            p = (await c2.execute(text("SELECT count(*) FROM profiles"))).scalar()
            print(f"\nAfter: users={u} profiles={p} (admin-only).\n")
    finally:
        await engine.dispose()
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--execute", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    sys.exit(asyncio.run(main(execute=ap.parse_args().execute)))
