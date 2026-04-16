#!/usr/bin/env python3
"""
Revoke admin role from a Firebase user.

Usage:
    python backend/scripts/revoke_admin.py --email sujatha@match4marriage.com

Removes "admin" from the `roles` custom claim. Preserves other claims.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from firebase_admin import auth as firebase_auth  # noqa: E402
from app.core.firebase import get_firebase_app  # noqa: E402


def revoke(email: str) -> None:
    app = get_firebase_app()
    if app is None:
        print("ERROR: Firebase is not configured.", file=sys.stderr)
        sys.exit(2)

    try:
        user = firebase_auth.get_user_by_email(email, app=app)
    except firebase_auth.UserNotFoundError:
        print(f"ERROR: No Firebase user with email {email!r}", file=sys.stderr)
        sys.exit(3)

    current = user.custom_claims or {}
    roles = [r for r in (current.get("roles") or []) if r != "admin"]
    new_claims = {**current, "roles": roles}
    if not roles:
        new_claims.pop("roles", None)

    firebase_auth.set_custom_user_claims(user.uid, new_claims, app=app)
    # Also revoke existing refresh tokens so they're forced to re-sign-in
    firebase_auth.revoke_refresh_tokens(user.uid, app=app)

    print(f"OK: admin role removed from {email}. Active sessions revoked.")


def main() -> None:
    p = argparse.ArgumentParser(description="Revoke admin role from a Firebase user.")
    p.add_argument("--email", required=True, help="Email address of the user")
    args = p.parse_args()
    revoke(args.email)


if __name__ == "__main__":
    main()
