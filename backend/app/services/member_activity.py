"""
Tell a member that another member did something that involves them:
expressed interest, accepted their interest, or sent a message.

One call creates the in-app notification (bell + /notifications tabs, which
filter on type "interest" / "message") and, when the member allows that kind
of email in Settings → Notifications, sends a short email.

Message alerts are coalesced: while a member still has an UNREAD message
notification for the same conversation, further messages in it don't create
another notification or email — so a burst of chat doesn't become a burst of
emails.

Never raises: a notification problem must not fail the action that caused it.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.notification import Notification
from app.models.user import User, UserProfile

logger = get_logger(__name__)


async def first_name(db: AsyncSession, user_id: uuid.UUID) -> str:
    name = (await db.execute(
        select(UserProfile.first_name).where(UserProfile.user_id == user_id)
    )).scalar_one_or_none()
    return (name or "").strip() or "A member"


async def notify_member(
    db: AsyncSession,
    *,
    recipient_id: uuid.UUID,
    tenant_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    action_url: str,
    extra: dict[str, Any] | None = None,
    email_kind: str | None = None,
    email_subject: str | None = None,
    email_cta: str = "Open Match4Marriage",
    coalesce_thread_id: uuid.UUID | None = None,
) -> bool:
    """Returns True if a new notification was created."""
    try:
        async with db.begin_nested():
            if coalesce_thread_id is not None:
                pending = (await db.execute(
                    select(Notification.extra_data).where(
                        Notification.user_id == recipient_id,
                        Notification.type == type,
                        Notification.is_read.is_(False),
                        Notification.deleted_at.is_(None),
                    ).order_by(Notification.created_at.desc()).limit(50)
                )).scalars().all()
                if any((x or {}).get("thread_id") == str(coalesce_thread_id) for x in pending):
                    return False

            db.add(Notification(
                tenant_id=tenant_id,
                user_id=recipient_id,
                type=type,
                title=title[:255],
                body=body,
                action_url=action_url,
                extra_data=extra or {},
                is_read=False,
            ))
            await db.flush()
    except Exception as e:
        logger.warning("member_notification_failed", recipient=str(recipient_id), type=type, error=str(e))
        return False

    if email_kind:
        await _maybe_email(db, recipient_id, email_kind, email_subject or title, title, body, email_cta, action_url)
    return True


async def _maybe_email(
    db: AsyncSession, recipient_id: uuid.UUID, kind: str,
    subject: str, heading: str, message: str, cta: str, path: str,
) -> None:
    try:
        from app.routers.auth import member_wants_email
        from app.services.email import send_member_activity_email

        user = (await db.execute(select(User).where(User.id == recipient_id))).scalar_one_or_none()
        if user is None or not user.email or user.deleted_at is not None or not user.is_active:
            return
        if not await member_wants_email(db, recipient_id, kind):
            return
        ok = await send_member_activity_email(
            user.email, await first_name(db, recipient_id),
            subject=subject, heading=heading, message=message, cta_label=cta, cta_path=path,
        )
        logger.info("member_activity_email", recipient=str(recipient_id), kind=kind, sent=bool(ok))
    except Exception as e:
        logger.warning("member_activity_email_failed", recipient=str(recipient_id), kind=kind, error=str(e))
