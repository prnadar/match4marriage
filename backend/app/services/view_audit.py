"""
Audit of *views* — who opened a member's contact details or identity documents.

`record_admin_action` (services/audit.py) covers changes. Reads of sensitive
personal data are logged here instead, throttled so an admin refreshing or
tabbing around one member doesn't flood the log: at most one row per
(admin, member, kind) per `window_minutes`.

The throttle is a lookup on the audit table itself rather than a Redis key, so
it behaves the same on every serverless instance and when Redis is the
in-memory fallback.

Actions written:
  access.view_contact     — member page / review panel with email, phone, address
  access.view_documents   — identity documents (ID front/back, selfie)

Never raises: a failed audit write must not break the page being opened.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.services.audit import record_admin_action

logger = get_logger(__name__)

VIEW_ACTIONS = {
    "contact": "access.view_contact",
    "documents": "access.view_documents",
}
DEFAULT_WINDOW_MINUTES = 15


async def record_member_view(
    db: AsyncSession,
    current_user: dict | None,
    kind: str,
    *,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    label: str | None = None,
    surface: str | None = None,
    window_minutes: int = DEFAULT_WINDOW_MINUTES,
    details: dict[str, Any] | None = None,
) -> bool:
    """Log that an admin viewed a member's `kind` data. Returns True when a row
    was written, False when throttled or on any failure."""
    action = VIEW_ACTIONS.get(kind)
    if action is None or not current_user:
        return False
    try:
        from app.models.admin_audit_log import AdminAuditLog

        actor_email = (current_user.get("email") or "").strip().lower() or None
        actor_id: uuid.UUID | None
        try:
            actor_id = uuid.UUID(str(current_user.get("sub", "")))
        except (TypeError, ValueError):
            actor_id = None

        since = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
        async with db.begin_nested():
            q = select(func.count()).select_from(AdminAuditLog).where(
                AdminAuditLog.tenant_id == tenant_id,
                AdminAuditLog.action == action,
                AdminAuditLog.target_id == str(user_id),
                AdminAuditLog.created_at >= since,
            )
            if actor_id is not None:
                q = q.where(AdminAuditLog.actor_id == actor_id)
            elif actor_email:
                q = q.where(func.lower(AdminAuditLog.actor_email) == actor_email)
            recent = (await db.execute(q)).scalar_one()
        if recent:
            return False

        await record_admin_action(
            db, current_user, action,
            tenant_id=tenant_id, target_type="user", target_id=user_id, target_label=label,
            details={**(details or {}), **({"surface": surface} if surface else {})} or None,
        )
        return True
    except Exception as exc:  # pragma: no cover — never break the page
        logger.warning("view_audit_failed", kind=kind, error=str(exc))
        return False
