#!/usr/bin/env python3
"""
Grant admin role to a Firebase user via custom claims.

Usage:
    python backend/scripts/grant_admin.py --email sujatha@match4marriage.com
    python backend/scripts/grant_admin.py --email new@example.com --create --password "strongpw"

The --create flag creates the Firebase user first if they don't exist, with the
given --password. Handy for bootstrapping the first admin.

Requires FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in
the backend .env (same values the API server uses). Run from repo root.

This mutates Firebase ONLY — no database changes. After running, the user must
sign in again (or wait up to 1 hour) for the new claims to appear in their ID
token. The admin-login page below forces a token refresh so the wait is zero.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Load the backend .env so FIREBASE_* vars are available
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass  # pydantic-settings will still pick it up

# Import through the app so Firebase is initialised the same way as at runtime
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from firebase_admin import auth as firebase_auth  # noqa: E402
from app.core.firebase import get_firebase_app  # noqa: E402


def grant(email: str, create: bool = False, password: str | None = None) -> None:
    app = get_firebase_app()
    if app is None:
        print("ERROR: Firebase is not configured. Set FIREBASE_* env vars in backend/.env", file=sys.stderr)
        sys.exit(2)

    try:
        user = firebase_auth.get_user_by_email(email, app=app)
        print(f"Found Firebase user: uid={user.uid} email={user.email}")
        if create and password:
            # Update the password if --create was used on an existing user
            firebase_auth.update_user(user.uid, password=password, app=app)
            print(f"Password updated for {email}")
    except firebase_auth.UserNotFoundError:
        if not create:
            print(f"ERROR: No Firebase user with email {email!r}. Add --create --password '<pw>' to provision.", file=sys.stderr)
            sys.exit(3)
        if not password:
            print("ERROR: --create requires --password '<pw>'.", file=sys.stderr)
            sys.exit(4)
        user = firebase_auth.create_user(
            email=email,
            password=password,
            email_verified=True,
            app=app,
        )
        print(f"Created Firebase user: uid={user.uid} email={email}")

    # Merge with any existing claims so we don't clobber them
    current = user.custom_claims or {}
    roles = list(current.get("roles") or [])
    if "admin" not in roles:
        roles.append("admin")
    new_claims = {**current, "roles": roles}

    firebase_auth.set_custom_user_claims(user.uid, new_claims, app=app)
    print(f"OK: {email} now has roles={roles}")
    print("The user must sign out and back in (or the client must call getIdToken(true))")
    print("for the new claims to appear in their token.")


def main() -> None:
    p = argparse.ArgumentParser(description="Grant admin role to a Firebase user.")
    p.add_argument("--email", required=True, help="Email address of the user to grant admin")
    p.add_argument("--create", action="store_true", help="Create the user if missing (requires --password)")
    p.add_argument("--password", help="Password to set if --create is used (or to reset)")
    args = p.parse_args()
    grant(args.email, create=args.create, password=args.password)


if __name__ == "__main__":
    main()
