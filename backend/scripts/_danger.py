"""Typed confirmation for scripts that destroy data.

backend/.env points at the LIVE database and Firebase project, so a bare
`--execute` was one command away from wiping real members. Destructive scripts
now require the target to be typed back (or passed with --confirm), and refuse
in non-interactive runs without it.
"""
import os
import sys
from urllib.parse import urlparse


def db_target() -> str:
    """Host of DATABASE_URL (no credentials), e.g. ep-green-dew-xxxx-pooler..."""
    return urlparse(os.getenv("DATABASE_URL", "")).hostname or "(unknown)"


def confirm(target: str, what: str, provided: str | None) -> bool:
    print(f"\n!! About to {what}.")
    print(f"!! Target: {target}")
    print("!! If this is production, real members' data is permanently lost.")
    typed = provided
    if typed is None:
        if not sys.stdin.isatty():
            print("Refusing: non-interactive run without --confirm.\n")
            return False
        typed = input(f"Type the target ({target}) to continue: ").strip()
    if typed != target:
        print("Target did not match. Nothing changed.\n")
        return False
    return True
