"""
Delete every user in the project's Firebase Auth pool so emails / phone
numbers used during testing become re-registrable.

Usage:
    python scripts/reset_firebase_users.py --dry-run
    python scripts/reset_firebase_users.py --execute

Reads service-account creds from backend/.env:
    FIREBASE_PROJECT_ID
    FIREBASE_CLIENT_EMAIL
    FIREBASE_PRIVATE_KEY    (the long PEM string, with literal "\n"
                             for newlines as stored in env files)

Pages through the Auth list 1,000 users at a time and batch-deletes
in 1,000-uid chunks (Firebase Admin's documented max per call).
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _bootstrap_firebase() -> None:
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        return

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
    private_key = os.getenv("FIREBASE_PRIVATE_KEY", "")
    # Env files commonly escape newlines as literal "\n"; undo that so the
    # SDK gets a real PEM. Idempotent if already raw.
    private_key = private_key.replace("\\n", "\n")

    missing = [k for k, v in {
        "FIREBASE_PROJECT_ID": project_id,
        "FIREBASE_CLIENT_EMAIL": client_email,
        "FIREBASE_PRIVATE_KEY": private_key,
    }.items() if not v]
    if missing:
        raise SystemExit(f"Missing env vars: {', '.join(missing)}")

    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": project_id,
        "client_email": client_email,
        "private_key": private_key,
        "token_uri": "https://oauth2.googleapis.com/token",
    })
    firebase_admin.initialize_app(cred, {"projectId": project_id})


def main(execute: bool) -> int:
    _bootstrap_firebase()
    from firebase_admin import auth as fb_auth

    print(f"\nProject: {os.getenv('FIREBASE_PROJECT_ID')}\n")

    # 1. Page through every user, summarising what we'll touch.
    uids: list[str] = []
    sample: list[tuple[str, str | None, str | None]] = []
    page = fb_auth.list_users()
    while page:
        for u in page.users:
            uids.append(u.uid)
            if len(sample) < 10:
                sample.append((u.uid, u.email, u.phone_number))
        page = page.get_next_page()

    print(f"── Firebase Auth users found: {len(uids)} ──")
    for uid, email, phone in sample:
        ident = email or phone or "(no email / phone)"
        print(f"  • {uid[:8]}…  {ident}")
    if len(uids) > len(sample):
        print(f"  …and {len(uids) - len(sample)} more")

    if not uids:
        print("\nNothing to delete.\n")
        return 0
    if not execute:
        print("\nDry run only. Re-run with --execute to delete every one of them.\n")
        return 0

    # 2. Batch-delete. Firebase Admin caps each call at 1,000 uids.
    print(f"\nDeleting {len(uids)} users …")
    total_success = 0
    total_failure = 0
    for i in range(0, len(uids), 1000):
        chunk = uids[i:i + 1000]
        result = fb_auth.delete_users(chunk)
        total_success += result.success_count
        total_failure += result.failure_count
        for err in result.errors[:5]:
            print(f"  ! failed uid index {err.index}: {err.reason}")
        if result.failure_count > 5:
            print(f"  …and {result.failure_count - 5} more failures in this chunk")

    print(f"\nDeleted {total_success}. Failed {total_failure}.\n")
    return 0 if total_failure == 0 else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="actually delete")
    parser.add_argument("--dry-run", action="store_true", help="show users only (default)")
    args = parser.parse_args()
    sys.exit(main(execute=args.execute))
