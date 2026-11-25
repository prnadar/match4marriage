"""
Admin CRM — contact members from inside the admin console.

  Per member
    GET    /admin/crm/users/{id}                 CRM card: tags, follow-up, notes, timeline
    PUT    /admin/crm/users/{id}/crm             update tags / follow-up date + note
    POST   /admin/crm/users/{id}/send            email and/or in-app message (merge fields)
    POST   /admin/crm/users/{id}/log             log an off-platform contact (call, WhatsApp…)
    POST   /admin/crm/users/{id}/notes           add an internal note
    PATCH  /admin/crm/users/{id}/notes/{note}    edit / pin a note
    DELETE /admin/crm/users/{id}/notes/{note}    remove a note

  Bulk
    POST   /admin/crm/audience/preview           recipient count + sample for a selection/segment
    POST   /admin/crm/broadcasts                 send to a selection or segment
    GET    /admin/crm/broadcasts                 broadcast history

  Console
    GET    /admin/crm/communications             global communication log (filterable)
    GET    /admin/crm/stats                      headline numbers for /admin/communications
    GET    /admin/crm/follow-ups                 members with a follow-up date
    GET    /admin/crm/meta                       tags, countries, segments, merge fields

Every route requires an admin/super_admin role and is scoped to the caller's
tenant. Nothing here is visible to members except the messages themselves.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user, has_admin_role, require_admin
from app.core.tenancy import get_current_tenant_slug
from app.models.admin_crm import (
    AdminBroadcast,
    AdminCommunication,
    AdminUserNote,
    CommunicationChannel,
    CommunicationStatus,
    UserCrmProfile,
)
from app.models.notification import Notification
from app.models.user import User, UserProfile
from app.schemas.common import APIResponse, PaginatedResponse
from app.services import crm as crm_svc
from app.services.email import (
    _html_to_plain,
    render_admin_message_html,
    send_admin_batch_emails,
    send_admin_message_email,
)

settings = get_settings()
logger = get_logger(__name__)

router = APIRouter(
    prefix="/admin/crm",
    tags=["admin-crm"],
    # Belt and braces: every route below also calls _require_admin().
    dependencies=[Depends(require_admin)],
)


# ─── Shared helpers ──────────────────────────────────────────────────────────


def _require_admin(current_user: dict) -> None:
    if not has_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Admin required")


async def _tenant(db: AsyncSession, tenant_slug: str) -> uuid.UUID:
    from app.routers.profile import _resolve_tenant_uuid
    t = await _resolve_tenant_uuid(db, tenant_slug)
    if t is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return t


def _admin_identity(current_user: dict) -> tuple[uuid.UUID | None, str | None]:
    try:
        aid = uuid.UUID(str(current_user.get("sub", "")))
    except (TypeError, ValueError):
        aid = None
    email = current_user.get("email")
    return aid, (str(email)[:255] if email else None)


async def _load_member(db: AsyncSession, tenant_uuid: uuid.UUID, user_id: uuid.UUID) -> tuple[User, UserProfile | None]:
    row = (await db.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.id == user_id, User.tenant_id == tenant_uuid)
    )).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row[0], row[1]


async def _get_or_create_crm(db: AsyncSession, tenant_uuid: uuid.UUID, user_id: uuid.UUID) -> UserCrmProfile:
    crm = (await db.execute(
        select(UserCrmProfile).where(
            UserCrmProfile.tenant_id == tenant_uuid,
            UserCrmProfile.user_id == user_id,
        )
    )).scalar_one_or_none()
    if crm is None:
        crm = UserCrmProfile(id=uuid.uuid4(), tenant_id=tenant_uuid, user_id=user_id, tags=[])
        db.add(crm)
        await db.flush()
    elif crm.deleted_at is not None:
        crm.deleted_at = None
    return crm


def _iso(v: Any) -> str | None:
    return v.isoformat() if v else None


def _member_name(p: UserProfile | None, u: User | None = None) -> str:
    if p and (p.first_name or p.last_name):
        return f"{p.first_name or ''} {p.last_name or ''}".strip()
    if u is not None:
        return u.email or u.phone or "Member"
    return "Member"


def _primary_photo(p: UserProfile | None) -> str | None:
    photos = (p.photos if p else None) or []
    url = next((ph.get("url") for ph in photos if isinstance(ph, dict) and ph.get("is_primary")), None)
    if url is None and photos and isinstance(photos[0], dict):
        url = photos[0].get("url")
    return url


def _ser_comm(c: AdminCommunication, u: User | None = None, p: UserProfile | None = None) -> dict[str, Any]:
    out = {
        "id": str(c.id),
        "user_id": str(c.user_id),
        "admin_email": c.admin_email,
        "channel": c.channel,
        "direction": c.direction,
        "subject": c.subject,
        "body": c.body,
        "to_address": c.to_address,
        "status": c.status,
        "error": c.error,
        "template_key": c.template_key,
        "broadcast_id": str(c.broadcast_id) if c.broadcast_id else None,
        "meta": c.meta or {},
        "sent_at": _iso(c.sent_at),
        "created_at": _iso(c.created_at),
    }
    if u is not None:
        out["user"] = {
            "id": str(u.id),
            "name": _member_name(p, u),
            "email": u.email,
            "membership_number": u.membership_number,
            "photo_url": _primary_photo(p),
        }
    return out


def _ser_note(n: AdminUserNote) -> dict[str, Any]:
    return {
        "id": str(n.id),
        "body": n.body,
        "pinned": bool(n.pinned),
        "admin_email": n.admin_email,
        "created_at": _iso(n.created_at),
        "updated_at": _iso(n.updated_at),
    }


def _ser_crm(crm: UserCrmProfile | None) -> dict[str, Any]:
    return {
        "tags": list(crm.tags or []) if crm else [],
        "follow_up_at": crm.follow_up_at.isoformat() if crm and crm.follow_up_at else None,
        "follow_up_note": crm.follow_up_note if crm else None,
    }


def _ser_broadcast(b: AdminBroadcast) -> dict[str, Any]:
    return {
        "id": str(b.id),
        "admin_email": b.admin_email,
        "channels": list(b.channels or []),
        "audience": b.audience or {},
        "audience_label": b.audience_label,
        "subject": b.subject,
        "body": b.body,
        "template_key": b.template_key,
        "recipient_count": b.recipient_count,
        "sent_count": b.sent_count,
        "failed_count": b.failed_count,
        "skipped_count": b.skipped_count,
        "status": b.status,
        "created_at": _iso(b.created_at),
        "completed_at": _iso(b.completed_at),
    }


# ─── Message delivery core ───────────────────────────────────────────────────


class MessageIn(BaseModel):
    channels: list[Literal["email", "in_app"]] = Field(min_length=1)
    subject: str = Field(default="", max_length=255)
    body: str = Field(min_length=1, max_length=20000)
    body_format: Literal["text", "html"] = "text"
    template_key: str | None = Field(default=None, max_length=64)
    reply_to: EmailStr | None = None
    # In-app deep link, e.g. "/subscription". Must be an internal path.
    action_url: str | None = Field(default=None, max_length=500)
    # Promotional content (offers, upgrades, newsletters). Under PECR/UK GDPR
    # these emails go only to members who opted in to "News & offers" in
    # Settings → Notifications. Service messages (default) reach everyone.
    is_marketing: bool = False


async def _marketing_email_opt_ins(db: AsyncSession, user_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    """Return the subset of `user_ids` who opted in to promotional email.

    Reads users.account_settings directly (the column is deferred on the ORM
    model). If the column doesn't exist yet or the read fails, nobody counts as
    opted in — the compliant default for marketing mail.
    """
    from app.routers.auth import _notification_prefs  # local: avoid import cycle

    opted_in: set[uuid.UUID] = set()
    try:
        async with db.begin_nested():
            for i in range(0, len(user_ids), 500):
                chunk = user_ids[i:i + 500]
                rows = (await db.execute(
                    select(User.id, User.account_settings).where(User.id.in_(chunk))
                )).all()
                for uid, raw in rows:
                    stored = raw
                    if isinstance(stored, str):
                        import json
                        try:
                            stored = json.loads(stored)
                        except ValueError:
                            stored = None
                    if _notification_prefs(stored if isinstance(stored, dict) else {}).get("email_marketing"):
                        opted_in.add(uid)
    except Exception as exc:  # column missing / transient DB error
        logger.warning("crm_marketing_optin_lookup_failed", error=str(exc))
        return set()
    return opted_in


def _validate_message(msg: MessageIn) -> None:
    if "email" in msg.channels and not msg.subject.strip():
        raise HTTPException(status_code=400, detail="An email needs a subject")
    if "in_app" in msg.channels and not msg.subject.strip():
        raise HTTPException(status_code=400, detail="An in-app message needs a title")
    if msg.action_url and not msg.action_url.startswith("/"):
        raise HTTPException(status_code=400, detail="action_url must be an internal path starting with /")


async def _deliver(
    db: AsyncSession,
    *,
    tenant_uuid: uuid.UUID,
    current_user: dict,
    rows: list[tuple[User, UserProfile | None]],
    msg: MessageIn,
    broadcast_id: uuid.UUID | None = None,
) -> tuple[list[AdminCommunication], dict[str, int]]:
    """Render per-recipient, send, and log one AdminCommunication per channel."""
    admin_id, admin_email = _admin_identity(current_user)
    now = datetime.now(timezone.utc)
    channels = list(dict.fromkeys(msg.channels))  # de-dupe, keep order
    comms: list[AdminCommunication] = []
    email_jobs: list[tuple[AdminCommunication, dict[str, Any]]] = []
    counts = {"sent": 0, "failed": 0, "skipped": 0}

    def _comm(u: User, channel: str, subject: str, body: str, to: str | None, status: str, **kw) -> AdminCommunication:
        c = AdminCommunication(
            id=uuid.uuid4(),
            tenant_id=tenant_uuid,
            user_id=u.id,
            admin_user_id=admin_id,
            admin_email=admin_email,
            channel=channel,
            direction="outbound",
            subject=subject[:255] if subject else None,
            body=body,
            to_address=to,
            status=status,
            template_key=msg.template_key,
            broadcast_id=broadcast_id,
            meta=kw.pop("meta", {}) or {},
            sent_at=kw.pop("sent_at", None),
            error=kw.pop("error", None),
        )
        comms.append(c)
        return c

    marketing_ok: set[uuid.UUID] | None = None
    if msg.is_marketing and "email" in channels:
        marketing_ok = await _marketing_email_opt_ins(db, [u.id for u, _ in rows])

    for u, p in rows:
        ctx = crm_svc.merge_context(u, p)
        subject = crm_svc.merge_fields(msg.subject, ctx).strip()
        if msg.body_format == "html":
            body_html = crm_svc.merge_fields(msg.body, ctx, escape_html=True)
            body_text = _html_to_plain(body_html)
        else:
            body_text = crm_svc.merge_fields(msg.body, ctx).strip()
            body_html = crm_svc.text_to_html(body_text)

        # PECR: every promotional email must tell the recipient why they got it
        # and give a simple way to opt out.
        email_text, email_html = body_text, body_html
        if msg.is_marketing:
            prefs_url = f"{settings.FRONTEND_URL.rstrip('/')}/settings?section=notifications"
            email_text = (
                f"{body_text}\n\n—\nYou're receiving this because you opted in to news & offers "
                f"from Match4Marriage. To stop these emails, turn off \"News & offers\" here: {prefs_url}"
            )
            email_html = (
                f"{body_html}"
                '<p style="margin-top:24px;font-size:12px;color:#78686e;line-height:1.5">'
                "You're receiving this because you opted in to news &amp; offers from Match4Marriage. "
                f'<a href="{prefs_url}" style="color:#dc1e3c">Unsubscribe or change your email preferences</a>.'
                "</p>"
            )

        if "email" in channels:
            if not u.email:
                _comm(u, CommunicationChannel.EMAIL, subject, body_text, None,
                      CommunicationStatus.SKIPPED, error="No email address on file")
                counts["skipped"] += 1
            elif marketing_ok is not None and u.id not in marketing_ok:
                _comm(u, CommunicationChannel.EMAIL, subject, body_text, u.email,
                      CommunicationStatus.SKIPPED, error="Not opted in to promotional emails")
                counts["skipped"] += 1
            else:
                c = _comm(u, CommunicationChannel.EMAIL, subject, body_text, u.email,
                          CommunicationStatus.SENT, meta={"body_format": msg.body_format})
                email_jobs.append((c, {
                    "to": u.email,
                    "subject": subject,
                    "html": render_admin_message_html(subject, email_html),
                    "text": email_text,
                    "reply_to": str(msg.reply_to) if msg.reply_to else None,
                }))

        if "in_app" in channels:
            nid = uuid.uuid4()
            db.add(Notification(
                id=nid,
                tenant_id=tenant_uuid,
                user_id=u.id,
                type="system",
                title=subject[:255] or "Message from Match4Marriage",
                body=body_text[:5000],
                is_read=False,
                action_url=msg.action_url,
                extra_data={"source": "admin", "from": "Match4Marriage team"},
            ))
            _comm(u, CommunicationChannel.IN_APP, subject, body_text, None,
                  CommunicationStatus.SENT, sent_at=now, meta={"notification_id": str(nid), "action_url": msg.action_url})
            counts["sent"] += 1

    if email_jobs:
        if len(email_jobs) == 1:
            m = email_jobs[0][1]
            results = [await send_admin_message_email(m["to"], m["subject"], m["html"], m["text"], m["reply_to"])]
        else:
            results = await send_admin_batch_emails([m for _, m in email_jobs])
        for (c, _), r in zip(email_jobs, results):
            if r.get("ok"):
                c.status = CommunicationStatus.SENT
                c.sent_at = datetime.now(timezone.utc)
                c.provider_message_id = r.get("id")
                counts["sent"] += 1
            else:
                c.status = CommunicationStatus.FAILED
                c.error = r.get("error") or "Send failed"
                counts["failed"] += 1

    db.add_all(comms)
    await db.flush()
    return comms, counts


# ─── Per-member endpoints ────────────────────────────────────────────────────


@router.get("/users/{user_id}", response_model=APIResponse[dict])
async def get_member_crm(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    limit: int = Query(default=100, ge=1, le=500),
):
    """CRM card for one member: tags, follow-up, notes and the contact timeline."""
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    await _load_member(db, tenant_uuid, user_id)

    crm = (await db.execute(
        select(UserCrmProfile).where(
            UserCrmProfile.tenant_id == tenant_uuid,
            UserCrmProfile.user_id == user_id,
            UserCrmProfile.deleted_at.is_(None),
        )
    )).scalar_one_or_none()

    notes = (await db.execute(
        select(AdminUserNote).where(
            AdminUserNote.tenant_id == tenant_uuid,
            AdminUserNote.user_id == user_id,
            AdminUserNote.deleted_at.is_(None),
        ).order_by(AdminUserNote.pinned.desc(), AdminUserNote.created_at.desc())
    )).scalars().all()

    comms = (await db.execute(
        select(AdminCommunication).where(
            AdminCommunication.tenant_id == tenant_uuid,
            AdminCommunication.user_id == user_id,
            AdminCommunication.deleted_at.is_(None),
        ).order_by(AdminCommunication.created_at.desc()).limit(limit)
    )).scalars().all()

    by_channel_rows = (await db.execute(
        select(AdminCommunication.channel, func.count())
        .where(
            AdminCommunication.tenant_id == tenant_uuid,
            AdminCommunication.user_id == user_id,
            AdminCommunication.deleted_at.is_(None),
        ).group_by(AdminCommunication.channel)
    )).all()
    last_contacted = (await db.execute(
        select(func.max(AdminCommunication.created_at)).where(
            AdminCommunication.tenant_id == tenant_uuid,
            AdminCommunication.user_id == user_id,
            AdminCommunication.deleted_at.is_(None),
            AdminCommunication.status.in_([CommunicationStatus.SENT, CommunicationStatus.LOGGED]),
        )
    )).scalar_one_or_none()

    return APIResponse(success=True, data={
        **_ser_crm(crm),
        "notes": [_ser_note(n) for n in notes],
        "communications": [_ser_comm(c) for c in comms],
        "stats": {
            "total": sum(int(n) for _, n in by_channel_rows),
            "by_channel": {ch: int(n) for ch, n in by_channel_rows},
            "last_contacted_at": _iso(last_contacted),
        },
    })


class CrmUpdateIn(BaseModel):
    tags: list[str] | None = None
    follow_up_at: date | None = None
    follow_up_note: str | None = Field(default=None, max_length=500)


@router.put("/users/{user_id}/crm", response_model=APIResponse[dict])
async def update_member_crm(
    user_id: uuid.UUID,
    payload: CrmUpdateIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Partial update — only the fields present in the body are changed.
    Send ``"follow_up_at": null`` to clear the follow-up."""
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    await _load_member(db, tenant_uuid, user_id)
    crm = await _get_or_create_crm(db, tenant_uuid, user_id)

    fields = payload.model_fields_set
    if "tags" in fields:
        crm.tags = crm_svc.clean_tags(payload.tags)
    if "follow_up_at" in fields:
        crm.follow_up_at = payload.follow_up_at
        if payload.follow_up_at is None and "follow_up_note" not in fields:
            crm.follow_up_note = None
    if "follow_up_note" in fields:
        crm.follow_up_note = (payload.follow_up_note or "").strip() or None
    await db.flush()
    logger.info("admin_crm_update", admin=current_user.get("sub"), target=str(user_id), fields=sorted(fields))
    return APIResponse(success=True, data=_ser_crm(crm))


@router.post("/users/{user_id}/send", response_model=APIResponse[dict])
async def send_to_member(
    user_id: uuid.UUID,
    payload: MessageIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """
    Email and/or in-app message one member. The log row is written even when
    the email provider fails, so the response is 200 with per-channel status —
    the UI reads ``results[].status``.
    """
    _require_admin(current_user)
    _validate_message(payload)
    tenant_uuid = await _tenant(db, tenant_slug)
    u, p = await _load_member(db, tenant_uuid, user_id)
    if u.deleted_at is not None:
        raise HTTPException(status_code=400, detail="This member has been deleted")
    if payload.channels == ["email"] and not u.email:
        raise HTTPException(status_code=400, detail="This member has no email address on file")

    comms, counts = await _deliver(db, tenant_uuid=tenant_uuid, current_user=current_user, rows=[(u, p)], msg=payload)
    logger.info("admin_crm_send", admin=current_user.get("sub"), target=str(user_id), channels=payload.channels, **counts)
    return APIResponse(success=True, data={"results": [_ser_comm(c) for c in comms], **counts})


class LogContactIn(BaseModel):
    channel: Literal["call", "whatsapp", "sms", "meeting", "email", "other"]
    subject: str | None = Field(default=None, max_length=255)
    body: str = Field(default="", max_length=5000)
    outcome: str | None = Field(default=None, max_length=64)  # e.g. "reached", "no_answer", "voicemail"


@router.post("/users/{user_id}/log", response_model=APIResponse[dict])
async def log_contact(
    user_id: uuid.UUID,
    payload: LogContactIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Record a contact made outside the platform (phone call, WhatsApp…)."""
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    u, p = await _load_member(db, tenant_uuid, user_id)
    admin_id, admin_email = _admin_identity(current_user)
    contact = crm_svc.extract_contact(u, p)
    to = u.email if payload.channel == "email" else contact.get("phone_e164")
    now = datetime.now(timezone.utc)
    c = AdminCommunication(
        id=uuid.uuid4(),
        tenant_id=tenant_uuid,
        user_id=u.id,
        admin_user_id=admin_id,
        admin_email=admin_email,
        channel=payload.channel,
        direction="outbound",
        subject=(payload.subject or "").strip() or None,
        body=payload.body.strip(),
        to_address=to,
        status=CommunicationStatus.LOGGED,
        meta={"outcome": payload.outcome} if payload.outcome else {},
        sent_at=now,
    )
    db.add(c)
    await db.flush()
    return APIResponse(success=True, data=_ser_comm(c))


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    pinned: bool = False


class NotePatch(BaseModel):
    body: str | None = Field(default=None, min_length=1, max_length=5000)
    pinned: bool | None = None


@router.post("/users/{user_id}/notes", response_model=APIResponse[dict])
async def add_note(
    user_id: uuid.UUID,
    payload: NoteIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    await _load_member(db, tenant_uuid, user_id)
    admin_id, admin_email = _admin_identity(current_user)
    n = AdminUserNote(
        id=uuid.uuid4(), tenant_id=tenant_uuid, user_id=user_id,
        admin_user_id=admin_id, admin_email=admin_email,
        body=payload.body.strip(), pinned=payload.pinned,
    )
    db.add(n)
    await db.flush()
    await db.refresh(n)
    return APIResponse(success=True, data=_ser_note(n))


async def _load_note(db: AsyncSession, tenant_uuid: uuid.UUID, user_id: uuid.UUID, note_id: uuid.UUID) -> AdminUserNote:
    n = (await db.execute(
        select(AdminUserNote).where(
            AdminUserNote.id == note_id,
            AdminUserNote.user_id == user_id,
            AdminUserNote.tenant_id == tenant_uuid,
            AdminUserNote.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    return n


@router.patch("/users/{user_id}/notes/{note_id}", response_model=APIResponse[dict])
async def update_note(
    user_id: uuid.UUID,
    note_id: uuid.UUID,
    payload: NotePatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    n = await _load_note(db, tenant_uuid, user_id, note_id)
    if payload.body is not None:
        n.body = payload.body.strip()
    if payload.pinned is not None:
        n.pinned = payload.pinned
    await db.flush()
    await db.refresh(n)
    return APIResponse(success=True, data=_ser_note(n))


@router.delete("/users/{user_id}/notes/{note_id}", response_model=APIResponse[dict])
async def delete_note(
    user_id: uuid.UUID,
    note_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    n = await _load_note(db, tenant_uuid, user_id, note_id)
    n.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return APIResponse(success=True, data={"id": str(n.id)})


# ─── Bulk / broadcast ────────────────────────────────────────────────────────


class AudienceIn(BaseModel):
    audience: dict[str, Any]


class BroadcastIn(MessageIn):
    audience: dict[str, Any]
    # The count the admin confirmed in the UI. If the live audience has grown
    # by more than 10% since the preview, we refuse rather than surprise them.
    expected_count: int | None = Field(default=None, ge=0)


@router.post("/audience/preview", response_model=APIResponse[dict])
async def preview_audience(
    payload: AudienceIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """How many members a selection/segment resolves to, how many have an
    email address, and a small sample to eyeball before sending."""
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    q = crm_svc.build_audience_query(tenant_uuid, payload.audience)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    with_email = (await db.execute(
        select(func.count()).select_from(
            q.where(User.email.is_not(None), User.email != "").subquery()
        )
    )).scalar_one()
    sample_rows = (await db.execute(q.order_by(User.created_at.desc()).limit(8))).all()

    return APIResponse(success=True, data={
        "count": int(total),
        "with_email": int(with_email),
        "without_email": int(total) - int(with_email),
        "label": crm_svc.describe_audience(payload.audience),
        "capped": int(total) > crm_svc.MAX_AUDIENCE,
        "max": crm_svc.MAX_AUDIENCE,
        "sample": [
            {
                "id": str(u.id),
                "name": _member_name(p, u),
                "email": u.email,
                "photo_url": _primary_photo(p),
                "membership_number": u.membership_number,
            }
            for u, p in sample_rows
        ],
    })


@router.post("/broadcasts", response_model=APIResponse[dict])
async def send_broadcast(
    payload: BroadcastIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    _validate_message(payload)
    tenant_uuid = await _tenant(db, tenant_slug)
    q = crm_svc.build_audience_query(tenant_uuid, payload.audience)
    rows = [(u, p) for u, p in (await db.execute(
        q.order_by(User.created_at.desc()).limit(crm_svc.MAX_AUDIENCE + 1)
    )).all()]

    if not rows:
        raise HTTPException(status_code=400, detail="This audience has no members")
    if len(rows) > crm_svc.MAX_AUDIENCE:
        raise HTTPException(status_code=400, detail=f"Audience exceeds {crm_svc.MAX_AUDIENCE} members — narrow the segment")
    if payload.expected_count is not None and len(rows) > max(payload.expected_count * 1.1, payload.expected_count + 5):
        raise HTTPException(
            status_code=409,
            detail=f"Audience changed since preview ({payload.expected_count} → {len(rows)}). Review and confirm again.",
        )

    admin_id, admin_email = _admin_identity(current_user)
    b = AdminBroadcast(
        id=uuid.uuid4(),
        tenant_id=tenant_uuid,
        admin_user_id=admin_id,
        admin_email=admin_email,
        channels=list(dict.fromkeys(payload.channels)),
        audience=payload.audience,
        audience_label=crm_svc.describe_audience(payload.audience)[:255],
        subject=payload.subject[:255] or None,
        body=payload.body,
        template_key=payload.template_key,
        recipient_count=len(rows),
        status="sending",
    )
    db.add(b)
    await db.flush()

    _, counts = await _deliver(
        db, tenant_uuid=tenant_uuid, current_user=current_user, rows=rows, msg=payload, broadcast_id=b.id,
    )
    b.sent_count = counts["sent"]
    b.failed_count = counts["failed"]
    b.skipped_count = counts["skipped"]
    b.status = "completed" if counts["failed"] == 0 else ("failed" if counts["sent"] == 0 else "partial")
    b.completed_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info("admin_crm_broadcast", admin=current_user.get("sub"), broadcast=str(b.id), recipients=len(rows), **counts)
    return APIResponse(success=True, data=_ser_broadcast(b))


@router.get("/broadcasts", response_model=PaginatedResponse[dict])
async def list_broadcasts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    base = select(AdminBroadcast).where(
        AdminBroadcast.tenant_id == tenant_uuid, AdminBroadcast.deleted_at.is_(None)
    )
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(
        base.order_by(AdminBroadcast.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return PaginatedResponse.create(items=[_ser_broadcast(b) for b in rows], total=total, page=page, limit=limit)


# ─── Console: log, stats, follow-ups, meta ───────────────────────────────────


@router.get("/communications", response_model=PaginatedResponse[dict])
async def list_communications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    channel: str | None = Query(default=None),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=100),
    user_id: uuid.UUID | None = Query(default=None),
    broadcast_id: uuid.UUID | None = Query(default=None),
    days: int | None = Query(default=None, ge=1, le=3650),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    base = (
        select(AdminCommunication, User, UserProfile)
        .join(User, User.id == AdminCommunication.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(
            AdminCommunication.tenant_id == tenant_uuid,
            AdminCommunication.deleted_at.is_(None),
            User.tenant_id == tenant_uuid,
        )
    )
    if channel:
        base = base.where(AdminCommunication.channel == channel)
    if status:
        base = base.where(AdminCommunication.status == status)
    if user_id:
        base = base.where(AdminCommunication.user_id == user_id)
    if broadcast_id:
        base = base.where(AdminCommunication.broadcast_id == broadcast_id)
    if days:
        base = base.where(AdminCommunication.created_at >= datetime.now(timezone.utc) - timedelta(days=days))
    if q:
        ql = f"%{q.lower()}%"
        base = base.where(or_(
            func.lower(AdminCommunication.subject).like(ql),
            func.lower(User.email).like(ql),
            func.lower(UserProfile.first_name).like(ql),
            func.lower(UserProfile.last_name).like(ql),
            User.membership_number.ilike(ql),
        ))

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(
        base.order_by(AdminCommunication.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).all()
    return PaginatedResponse.create(
        items=[_ser_comm(c, u, p) for c, u, p in rows], total=total, page=page, limit=limit,
    )


@router.get("/stats", response_model=APIResponse[dict])
async def crm_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    now = datetime.now(timezone.utc)
    since_30 = now - timedelta(days=30)
    since_7 = now - timedelta(days=7)
    base_where = (
        AdminCommunication.tenant_id == tenant_uuid,
        AdminCommunication.deleted_at.is_(None),
    )

    by_channel = (await db.execute(
        select(AdminCommunication.channel, AdminCommunication.status, func.count())
        .where(*base_where, AdminCommunication.created_at >= since_30)
        .group_by(AdminCommunication.channel, AdminCommunication.status)
    )).all()
    sent_7 = (await db.execute(
        select(func.count()).where(
            *base_where, AdminCommunication.created_at >= since_7,
            AdminCommunication.status.in_([CommunicationStatus.SENT, CommunicationStatus.LOGGED]),
        )
    )).scalar_one()
    members_30 = (await db.execute(
        select(func.count(func.distinct(AdminCommunication.user_id))).where(
            *base_where, AdminCommunication.created_at >= since_30,
        )
    )).scalar_one()

    today = date.today()
    crm_where = (
        UserCrmProfile.tenant_id == tenant_uuid,
        UserCrmProfile.deleted_at.is_(None),
        UserCrmProfile.follow_up_at.is_not(None),
    )
    due = (await db.execute(
        select(func.count()).where(*crm_where, UserCrmProfile.follow_up_at <= today)
    )).scalar_one()
    upcoming = (await db.execute(
        select(func.count()).where(
            *crm_where, UserCrmProfile.follow_up_at > today,
            UserCrmProfile.follow_up_at <= today + timedelta(days=7),
        )
    )).scalar_one()

    channels: dict[str, dict[str, int]] = {}
    sent_30 = failed_30 = 0
    for ch, st, n in by_channel:
        channels.setdefault(ch, {})[st] = int(n)
        if st in (CommunicationStatus.SENT, CommunicationStatus.LOGGED):
            sent_30 += int(n)
        elif st == CommunicationStatus.FAILED:
            failed_30 += int(n)

    return APIResponse(success=True, data={
        "sent_7d": int(sent_7),
        "sent_30d": sent_30,
        "failed_30d": failed_30,
        "members_contacted_30d": int(members_30),
        "by_channel_30d": channels,
        "follow_ups_due": int(due),
        "follow_ups_next_7d": int(upcoming),
        "email_configured": bool(settings.RESEND_API_KEY),
        "from_email": str(settings.RESEND_FROM_EMAIL),
    })


@router.get("/follow-ups", response_model=APIResponse[list[dict]])
async def list_follow_ups(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
    scope: Literal["due", "upcoming", "all"] = Query(default="all"),
    limit: int = Query(default=50, ge=1, le=200),
):
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)
    today = date.today()
    q = (
        select(UserCrmProfile, User, UserProfile)
        .join(User, User.id == UserCrmProfile.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(
            UserCrmProfile.tenant_id == tenant_uuid,
            UserCrmProfile.deleted_at.is_(None),
            UserCrmProfile.follow_up_at.is_not(None),
            User.tenant_id == tenant_uuid,
            User.deleted_at.is_(None),
        )
    )
    if scope == "due":
        q = q.where(UserCrmProfile.follow_up_at <= today)
    elif scope == "upcoming":
        q = q.where(UserCrmProfile.follow_up_at > today)
    rows = (await db.execute(q.order_by(UserCrmProfile.follow_up_at.asc()).limit(limit))).all()
    out = []
    for crm, u, p in rows:
        contact = crm_svc.extract_contact(u, p)
        out.append({
            "user_id": str(u.id),
            "name": _member_name(p, u),
            "email": u.email,
            "phone_e164": contact["phone_e164"],
            "whatsapp_number": contact["whatsapp_number"],
            "photo_url": _primary_photo(p),
            "membership_number": u.membership_number,
            "plan": crm_svc.plan_label(u.subscription_tier.value if u.subscription_tier else None),
            **_ser_crm(crm),
            "overdue": bool(crm.follow_up_at and crm.follow_up_at < today),
        })
    return APIResponse(success=True, data=out)


@router.get("/meta", response_model=APIResponse[dict])
async def crm_meta(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    """Options for the compose / broadcast UI: tags in use (with counts),
    countries members live in, segment catalogue, merge fields."""
    _require_admin(current_user)
    tenant_uuid = await _tenant(db, tenant_slug)

    tag_rows = (await db.execute(
        select(UserCrmProfile.tags).where(
            UserCrmProfile.tenant_id == tenant_uuid,
            UserCrmProfile.deleted_at.is_(None),
        )
    )).scalars().all()
    tag_counts: dict[str, int] = {}
    for tags in tag_rows:
        for t in tags or []:
            tag_counts[t] = tag_counts.get(t, 0) + 1

    country_rows = (await db.execute(
        select(func.trim(UserProfile.country), func.count())
        .join(User, User.id == UserProfile.user_id)
        .where(
            UserProfile.tenant_id == tenant_uuid,
            User.deleted_at.is_(None),
            UserProfile.country.is_not(None),
            func.trim(UserProfile.country) != "",
        )
        .group_by(func.trim(UserProfile.country))
        .order_by(func.count().desc())
        .limit(60)
    )).all()

    return APIResponse(success=True, data={
        "tags": [{"tag": t, "count": n} for t, n in sorted(tag_counts.items(), key=lambda kv: (-kv[1], kv[0].lower()))],
        "suggested_tags": crm_svc.SUGGESTED_TAGS,
        "countries": [{"country": c, "count": int(n)} for c, n in country_rows],
        "segments": [{"key": k, "label": v} for k, v in crm_svc.SEGMENTS.items()],
        "merge_fields": crm_svc.MERGE_FIELDS,
        "do_not_contact_tag": crm_svc.DO_NOT_CONTACT,
        "email_configured": bool(settings.RESEND_API_KEY),
    })

