"""
Member messaging.

Members who have expressed mutual interest get a ChatThread (created in
matches.send_interest). Messaging works over plain HTTPS so it runs on
serverless hosting (Vercel has no WebSockets): the client sends with POST and
polls GET .../messages?after=<timestamp> every few seconds while a
conversation is open.

GET  /api/v1/chats                          — conversations, with the other member's card,
                                              last-message preview and unread count
GET  /api/v1/chats/unread-count             — total unread messages (nav badge)
GET  /api/v1/chats/{id}                     — one conversation (header)
GET  /api/v1/chats/{id}/messages            — history, newest first, paginated;
                                              ?after=<iso> → only newer messages, oldest first
POST /api/v1/chats/{id}/messages            — send a text message (Premium+)
POST /api/v1/chats/{id}/read                — mark the other member's messages as read
WS   /ws/chat/{id}?token=                   — optional live channel where WebSockets exist

Message text is stored as-is in `encrypted_content` (legacy column name —
content is NOT end-to-end encrypted, so the UI must not claim it is).
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.core.security import _decode_token, get_current_user
from app.core.tenancy import get_current_tenant_slug
from app.models.match import ChatThread, Message, MessageType
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.match import ChatThreadRead, MessageRead

router = APIRouter(tags=["chat"])
logger = get_logger(__name__)

MAX_MESSAGE_CHARS = 2000
PREVIEW_CHARS = 120


# ── Helpers ──────────────────────────────────────────────────────────────────

def _me(current_user: dict) -> uuid.UUID:
    try:
        return uuid.UUID(str(current_user.get("sub", "")))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid user session")


def _naive_utc_now() -> datetime:
    # Message/thread timestamps are TIMESTAMP WITHOUT TIME ZONE (naive UTC).
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _other(thread: ChatThread, me: uuid.UUID) -> uuid.UUID:
    return thread.user_b_id if thread.user_a_id == me else thread.user_a_id


async def _thread_for(db: AsyncSession, thread_id: uuid.UUID, me: uuid.UUID) -> ChatThread:
    """The thread, if `me` is a participant — otherwise 404 (never reveal
    that a thread exists to a non-participant)."""
    thread = (await db.execute(
        select(ChatThread).where(ChatThread.id == thread_id, ChatThread.deleted_at.is_(None))
    )).scalar_one_or_none()
    if thread is None or me not in (thread.user_a_id, thread.user_b_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return thread


async def _thread_reads(db: AsyncSession, threads: list[ChatThread], me: uuid.UUID) -> list[ChatThreadRead]:
    """ChatThreadRead rows enriched with the other member's card and unread count."""
    if not threads:
        return []
    from app.routers.matches import _hydrate_profile_cards
    from app.schemas.user import ProfileCard

    others = {t.id: _other(t, me) for t in threads}
    cards: dict[uuid.UUID, dict] = {}
    for tenant_id in {t.tenant_id for t in threads}:
        cards.update(await _hydrate_profile_cards(
            db, [others[t.id] for t in threads if t.tenant_id == tenant_id], tenant_id,
        ))

    unread_rows = (await db.execute(
        select(Message.thread_id, func.count())
        .where(
            Message.thread_id.in_([t.id for t in threads]),
            Message.sender_id != me,
            Message.read_at.is_(None),
            Message.deleted_at.is_(None),
        )
        .group_by(Message.thread_id)
    )).all()
    unread = {tid: n for tid, n in unread_rows}

    out = []
    for t in threads:
        r = ChatThreadRead.model_validate(t)
        card = cards.get(others[t.id])
        r.other_profile = ProfileCard.model_validate(card) if card else None
        r.unread_count = int(unread.get(t.id, 0))
        out.append(r)
    return out


async def _create_message(db: AsyncSession, thread: ChatThread, sender: uuid.UUID, content: str) -> Message:
    """Validate + store one text message and notify the recipient. Shared by
    the REST endpoint and the WebSocket. Raises HTTPException on refusal."""
    text = (content or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="Write a message before sending.")
    if len(text) > MAX_MESSAGE_CHARS:
        raise HTTPException(status_code=422, detail=f"Messages can be up to {MAX_MESSAGE_CHARS} characters.")
    if not thread.is_active:
        raise HTTPException(status_code=403, detail="This conversation has been closed.")

    from app.core.entitlements import can_message, get_user_plan
    if not can_message(await get_user_plan(db, sender)):
        raise HTTPException(status_code=403, detail="Messaging is a Premium feature. Upgrade to reply.")

    from app.models.user import User
    recipient_id = _other(thread, sender)
    recipient = (await db.execute(select(User).where(User.id == recipient_id))).scalar_one_or_none()
    if recipient is None or recipient.deleted_at is not None or not recipient.is_active:
        raise HTTPException(status_code=410, detail="This member is no longer available.")

    now = _naive_utc_now()
    msg = Message(
        tenant_id=thread.tenant_id,
        thread_id=thread.id,
        sender_id=sender,
        message_type=MessageType.TEXT,
        encrypted_content=text,
    )
    db.add(msg)
    thread.last_message_at = now
    thread.last_message_preview = text[:PREVIEW_CHARS]
    await db.flush()
    await db.refresh(msg)

    from app.services.member_activity import first_name, notify_member
    name = await first_name(db, sender)
    await notify_member(
        db,
        recipient_id=recipient_id,
        tenant_id=thread.tenant_id,
        type="message",
        title=f"New message from {name}",
        body=text[:PREVIEW_CHARS] + ("…" if len(text) > PREVIEW_CHARS else ""),
        action_url=f"/messages/{thread.id}",
        extra={"thread_id": str(thread.id), "sender_id": str(sender)},
        email_kind="email_messages",
        email_subject=f"{name} sent you a message on Match4Marriage",
        email_cta="Read and reply",
        coalesce_thread_id=thread.id,
    )
    logger.info("chat_message_sent", thread=str(thread.id), sender=str(sender))
    return msg


# ── REST ─────────────────────────────────────────────────────────────────────

@router.get("/chats", response_model=PaginatedResponse[ChatThreadRead])
async def list_threads(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    tenant_slug: str = Depends(get_current_tenant_slug),
):
    try:
        me = _me(current_user)
    except HTTPException:
        return PaginatedResponse.create([], 0, page, limit)

    from app.routers.profile import _resolve_tenant_uuid
    tenant_uuid = await _resolve_tenant_uuid(db, tenant_slug)
    thread_filter = (
        ChatThread.tenant_id == tenant_uuid,
        or_(ChatThread.user_a_id == me, ChatThread.user_b_id == me),
        ChatThread.is_active.is_(True),
        ChatThread.deleted_at.is_(None),
    )
    total = (await db.execute(select(func.count()).select_from(ChatThread).where(*thread_filter))).scalar() or 0
    threads = (await db.execute(
        select(ChatThread)
        .where(*thread_filter)
        # New matches (no message yet) sort by when they matched.
        .order_by(func.coalesce(ChatThread.last_message_at, ChatThread.created_at).desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )).scalars().all()
    return PaginatedResponse.create(await _thread_reads(db, list(threads), me), total, page, limit)


@router.get("/chats/unread-count")
async def unread_count(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    me = _me(current_user)
    n = (await db.execute(
        select(func.count())
        .select_from(Message)
        .join(ChatThread, ChatThread.id == Message.thread_id)
        .where(
            or_(ChatThread.user_a_id == me, ChatThread.user_b_id == me),
            ChatThread.deleted_at.is_(None),
            ChatThread.is_active.is_(True),
            Message.sender_id != me,
            Message.read_at.is_(None),
            Message.deleted_at.is_(None),
        )
    )).scalar() or 0
    return APIResponse(success=True, data={"unread": int(n)})


@router.get("/chats/{thread_id}", response_model=APIResponse[ChatThreadRead])
async def get_thread(
    thread_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    me = _me(current_user)
    thread = await _thread_for(db, thread_id, me)
    return APIResponse(success=True, data=(await _thread_reads(db, [thread], me))[0])


@router.get("/chats/{thread_id}/messages", response_model=PaginatedResponse[MessageRead])
async def get_messages(
    thread_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    after: datetime | None = None,
):
    """History newest-first (paged), or — with `after` — every message newer
    than that timestamp, oldest-first, for polling."""
    me = _me(current_user)
    await _thread_for(db, thread_id, me)
    msg_filter = [Message.thread_id == thread_id, Message.deleted_at.is_(None)]

    if after is not None:
        # created_at is timestamptz; the client echoes back the last
        # created_at it saw, which may or may not carry an offset.
        after = after.replace(tzinfo=timezone.utc) if after.tzinfo is None else after.astimezone(timezone.utc)
        rows = (await db.execute(
            select(Message).where(*msg_filter, Message.created_at > after)
            .order_by(Message.created_at.asc()).limit(limit)
        )).scalars().all()
        return PaginatedResponse.create([MessageRead.model_validate(m) for m in rows], len(rows), 1, limit)

    total = (await db.execute(select(func.count()).select_from(Message).where(*msg_filter))).scalar() or 0
    rows = (await db.execute(
        select(Message).where(*msg_filter)
        .order_by(Message.created_at.desc())
        .offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return PaginatedResponse.create([MessageRead.model_validate(m) for m in rows], total, page, limit)


class SendTextRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS * 2)


@router.post("/chats/{thread_id}/messages", response_model=APIResponse[MessageRead])
@limiter.limit("30/minute")
async def send_message(
    request: Request,
    thread_id: uuid.UUID,
    payload: SendTextRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    me = _me(current_user)
    thread = await _thread_for(db, thread_id, me)
    msg = await _create_message(db, thread, me, payload.content)
    return APIResponse(success=True, data=MessageRead.model_validate(msg))


@router.post("/chats/{thread_id}/read", response_model=APIResponse[dict])
async def mark_thread_read(
    thread_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Mark every message the other member sent in this conversation as read,
    and clear the matching message notifications from the bell."""
    me = _me(current_user)
    await _thread_for(db, thread_id, me)
    now = _naive_utc_now()
    res = await db.execute(
        update(Message)
        .where(
            Message.thread_id == thread_id,
            Message.sender_id != me,
            Message.read_at.is_(None),
            Message.deleted_at.is_(None),
        )
        .values(read_at=now)
        .execution_options(synchronize_session=False)
    )
    from app.models.notification import Notification
    notes = (await db.execute(
        select(Notification).where(
            Notification.user_id == me,
            Notification.type == "message",
            Notification.is_read.is_(False),
            Notification.deleted_at.is_(None),
        )
    )).scalars().all()
    for n in notes:
        if (n.extra_data or {}).get("thread_id") == str(thread_id):
            n.is_read = True
            n.read_at = datetime.now(timezone.utc)
    await db.flush()
    return APIResponse(success=True, data={"marked": res.rowcount or 0})


# ── WebSocket (optional live channel; not available on Vercel) ───────────────

_connections: dict[str, list[WebSocket]] = {}


async def _ws_user(token: str) -> uuid.UUID | None:
    """Resolve a Firebase token to the member's User.id — the same identity
    the REST API uses. (Previously the raw Firebase uid was used, which is
    never a UUID, so every connection was rejected.)"""
    from app.core.config import get_settings
    from app.core.security import _find_or_link_user
    try:
        claims = _decode_token(token)
    except HTTPException:
        return None
    async with AsyncSessionLocal() as db:
        try:
            uid = await _find_or_link_user(
                db, claims["firebase_uid"],
                claims.get("phone_number") or claims.get("phone"),
                claims.get("email"),
                get_settings().DEFAULT_TENANT_SLUG,
            )
            await db.commit()
            return uid
        except Exception:
            return None


@router.websocket("/ws/chat/{thread_id}")
async def websocket_chat(websocket: WebSocket, thread_id: str, token: str = Query(...)):
    me = await _ws_user(token)
    try:
        thread_uuid = uuid.UUID(thread_id)
    except ValueError:
        thread_uuid = None
    if me is None or thread_uuid is None:
        await websocket.close(code=4001)
        return
    async with AsyncSessionLocal() as db:
        try:
            await _thread_for(db, thread_uuid, me)
        except HTTPException:
            await websocket.close(code=4003)
            return

    await websocket.accept()
    _connections.setdefault(thread_id, []).append(websocket)
    try:
        while True:
            try:
                data = json.loads(await websocket.receive_text())
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "Invalid JSON"})
                continue
            if data.get("type") != "message":
                continue
            async with AsyncSessionLocal() as db:
                try:
                    thread = await _thread_for(db, thread_uuid, me)
                    msg = await _create_message(db, thread, me, data.get("content", ""))
                    await db.commit()
                except HTTPException as e:
                    await websocket.send_json({"type": "error", "detail": e.detail})
                    continue
            out = {"type": "message", **json.loads(MessageRead.model_validate(msg).model_dump_json())}
            for ws in list(_connections.get(thread_id, [])):
                try:
                    await ws.send_json(out)
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        _connections[thread_id] = [s for s in _connections.get(thread_id, []) if s is not websocket]
