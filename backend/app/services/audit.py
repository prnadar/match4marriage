"""
Admin audit trail helper.

Call `record_admin_action(...)` from any admin endpoint after the change has
been applied. It is deliberately forgiving:

  * it never raises — an audit failure must not fail the admin's action;
  * it writes inside a SAVEPOINT on the caller's session, so a failed insert
    (e.g. the table not created yet on a fresh DB) can't poison the caller's
    transaction; the row commits/rolls back together with the action itself;
  * when no session is supplied (endpoints that only touch Firebase, such as
    granting admin), it opens its own short-lived session and commits.

Tenant resolution: pass `tenant_id` when the caller already has it; otherwise
it's resolved from the request's tenant slug context var.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger

logger = get_logger(__name__)


def _actor(current_user: dict | None) -> tuple[uuid.UUID | None, str | None]:
    if not current_user:
        return None, None
    actor_id: uuid.UUID | None
    try:
        actor_id = uuid.UUID(str(current_user.get("sub", "")))
    except (TypeError, ValueError):
        actor_id = None
    email = current_user.get("email")
    return actor_id, (str(email)[:255] if email else None)


async def _resolve_tenant(db: AsyncSession, tenant_id: uuid.UUID | None) -> uuid.UUID | None:
    if tenant_id is not None:
        return tenant_id
    from app.core.tenancy import get_current_tenant_slug
    from app.routers.profile import _resolve_tenant_uuid
    return await _resolve_tenant_uuid(db, get_current_tenant_slug())


def _clean_details(details: dict[str, Any] | None) -> dict[str, Any] | None:
    """Drop anything that looks like a secret and make values JSON-safe."""
    if not details:
        return None
    out: dict[str, Any] = {}
    for k, v in details.items():
        kl = str(k).lower()
        if any(s in kl for s in ("secret", "password", "token")):
            out[k] = "•••"
            continue
        if isinstance(v, (str, int, float, bool)) or v is None:
            out[k] = v
        elif isinstance(v, (list, tuple)):
            out[k] = [x if isinstance(x, (str, int, float, bool)) or x is None else str(x) for x in v][:50]
        elif isinstance(v, dict):
            out[k] = {str(kk): (vv if isinstance(vv, (str, int, float, bool)) or vv is None else str(vv)) for kk, vv in list(v.items())[:50]}
        else:
            out[k] = str(v)
    return out


async def _insert(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    actor_email: str | None,
    action: str,
    target_type: str | None,
    target_id: str | None,
    target_label: str | None,
    summary: str | None,
    details: dict[str, Any] | None,
) -> None:
    from app.models.admin_audit_log import AdminAuditLog
    row = AdminAuditLog(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        actor_id=actor_id,
        actor_email=actor_email,
        action=action[:64],
        target_type=(target_type or None) and target_type[:32],
        target_id=(target_id or None) and str(target_id)[:64],
        target_label=(target_label or None) and target_label[:255],
        summary=summary,
        details=_clean_details(details),
    )
    db.add(row)
    await db.flush()


async def record_admin_action(
    db: AsyncSession | None,
    current_user: dict | None,
    action: str,
    *,
    tenant_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: Any = None,
    target_label: str | None = None,
    summary: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Append one audit row. Never raises."""
    actor_id, actor_email = _actor(current_user)
    tid = str(target_id) if target_id is not None else None
    try:
        if db is None:
            from app.core.database import AsyncSessionLocal
            async with AsyncSessionLocal() as own:
                tenant = await _resolve_tenant(own, tenant_id)
                if tenant is None:
                    return
                await _insert(
                    own, tenant_id=tenant, actor_id=actor_id, actor_email=actor_email,
                    action=action, target_type=target_type, target_id=tid,
                    target_label=target_label, summary=summary, details=details,
                )
                await own.commit()
            return

        async with db.begin_nested():
            tenant = await _resolve_tenant(db, tenant_id)
            if tenant is None:
                return
            await _insert(
                db, tenant_id=tenant, actor_id=actor_id, actor_email=actor_email,
                action=action, target_type=target_type, target_id=tid,
                target_label=target_label, summary=summary, details=details,
            )
    except Exception as exc:  # pragma: no cover — audit must never break the action
        logger.warning("admin_audit_write_failed", action=action, error=str(exc))
