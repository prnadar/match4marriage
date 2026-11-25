"""
CRM helpers shared by the admin user endpoints (routers/admin.py) and the
admin CRM router (routers/admin_crm.py):

  * extract_contact()       — one normalised view of a member's contact details
                              (account phone/email + the contact block members
                              fill in on their profile under kundali_data.contact)
  * merge_fields()          — {{first_name}}-style template substitution
  * build_audience_query()  — resolves a broadcast audience (explicit selection
                              or a named segment) into a tenant-scoped SELECT
"""
from __future__ import annotations

import html as _html
import re
import uuid
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Select, cast, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB

from app.models.admin_crm import UserCrmProfile
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import Gender, SubscriptionTier, User, UserProfile

# ─── Plans ───────────────────────────────────────────────────────────────────

# DB keeps legacy tier keys; the product sells Basic / Premium / Elite.
PLAN_LABELS = {"free": "Free", "silver": "Basic", "gold": "Premium", "platinum": "Elite"}


def plan_label(tier: str | None) -> str:
    if not tier:
        return "Free"
    return PLAN_LABELS.get(tier.lower(), tier.capitalize())


# ─── Contact details ─────────────────────────────────────────────────────────

# Dial codes we recognise when splitting an E.164 number for display. Longest
# first so "+971" wins over "+9".
_DIAL_CODES = sorted(
    ["+44", "+91", "+971", "+1", "+61", "+65", "+49", "+33", "+31", "+353", "+92",
     "+880", "+94", "+977", "+27", "+254", "+256", "+60", "+64", "+974", "+966",
     "+968", "+973", "+965", "+39", "+34", "+41", "+46", "+47", "+45", "+852", "+86"],
    key=len, reverse=True,
)


def _digits(s: str | None) -> str:
    return re.sub(r"\D", "", s or "")


def normalise_phone(raw: str | None, country_code: str | None = None) -> str | None:
    """
    Best-effort E.164 (``+447700900123``) from whatever we stored. Account
    phones from Firebase phone-auth are already E.164; numbers typed into the
    profile contact form are national format plus a separate country code.
    UK-local numbers ("07…") with no country code are assumed +44 — this is a
    UK bureau.
    """
    if not raw or not str(raw).strip():
        return None
    s = str(raw).strip()
    d = _digits(s)
    if not d:
        return None
    if s.startswith("+"):
        return "+" + d
    if d.startswith("00") and len(d) > 8:
        return "+" + d[2:]
    cc = _digits(country_code)
    if cc:
        national = d.lstrip("0")
        if d.startswith(cc) and len(d) >= len(cc) + 9:
            return "+" + d  # already includes the country code
        return "+" + cc + national
    if d.startswith("07") and len(d) == 11:
        return "+44" + d[1:]
    if d.startswith("44") and len(d) >= 11:
        return "+" + d
    return d  # unknown — return digits without guessing a country


def split_dial_code(e164: str | None) -> tuple[str | None, str | None]:
    if not e164 or not e164.startswith("+"):
        return None, e164
    for code in _DIAL_CODES:
        if e164.startswith(code):
            return code, e164[len(code):]
    return None, e164


def extract_contact(u: User, p: UserProfile | None) -> dict[str, Any]:
    """Everything an admin needs to reach this member, in one dict."""
    kd = (p.kundali_data if p else None) or {}
    c = kd.get("contact") if isinstance(kd, dict) else None
    c = c if isinstance(c, dict) else {}

    profile_cc = (c.get("countryCode") or "").strip() or None
    profile_mobile = (c.get("mobile") or "").strip() or None

    phone_e164 = normalise_phone(u.phone) if u.phone else None
    phone_source = "account" if phone_e164 else None
    if not phone_e164 and profile_mobile:
        phone_e164 = normalise_phone(profile_mobile, profile_cc)
        phone_source = "profile" if phone_e164 else None

    dial, national = split_dial_code(phone_e164)
    preferred = (c.get("preferredContact") or "").strip() or None
    wa_digits = _digits(phone_e164) if phone_e164 and phone_e164.startswith("+") else None

    alt = (c.get("altPhone") or "").strip() or None
    address_parts = [c.get("address1"), c.get("address2"), c.get("city"), c.get("postcode"), c.get("country")]
    address = ", ".join(str(x).strip() for x in address_parts if x and str(x).strip()) or None

    return {
        "phone_e164": phone_e164,
        "phone_country_code": dial,
        "phone_national": national,
        "phone_source": phone_source,
        "alt_phone": normalise_phone(alt) if alt else None,
        "whatsapp_number": wa_digits,  # digits only, ready for https://wa.me/<digits>
        "whatsapp_available": bool(wa_digits),
        "whatsapp_preferred": (preferred or "").lower() == "whatsapp",
        "preferred_contact": preferred,
        "best_time_to_call": (c.get("bestTimeToCall") or "").strip() or None,
        "contact_person_name": (c.get("contactPersonName") or "").strip() or None,
        "contact_relationship": (c.get("contactRelationship") or "").strip() or None,
        "address": address,
    }


# ─── Merge fields ────────────────────────────────────────────────────────────

MERGE_FIELDS = [
    "first_name", "last_name", "full_name", "email", "phone",
    "membership_number", "plan", "city", "country",
]

_MERGE_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def merge_context(u: User, p: UserProfile | None) -> dict[str, str]:
    first = (p.first_name if p else "") or ""
    last = (p.last_name if p else "") or ""
    contact = extract_contact(u, p)
    return {
        "first_name": first or "there",
        "last_name": last,
        "full_name": (f"{first} {last}".strip()) or "Member",
        "email": u.email or "",
        "phone": contact["phone_e164"] or "",
        "membership_number": u.membership_number or "",
        "plan": plan_label(u.subscription_tier.value if u.subscription_tier else None),
        "city": (p.city if p else "") or "",
        "country": (p.country if p else "") or "",
    }


def merge_fields(text: str | None, ctx: dict[str, str], *, escape_html: bool = False) -> str:
    """Replace known {{field}} tokens; leave unknown tokens untouched."""
    if not text:
        return ""

    def _sub(m: re.Match) -> str:
        key = m.group(1).lower()
        if key not in ctx:
            return m.group(0)
        v = ctx[key]
        return _html.escape(v) if escape_html else v

    return _MERGE_RE.sub(_sub, text)


def text_to_html(text: str) -> str:
    """Plain text (already merged) → simple paragraphs for the email shell."""
    esc = _html.escape(text or "")
    paras = [p.strip() for p in re.split(r"\n\s*\n", esc) if p.strip()]
    return "".join(
        f'<p style="margin:0 0 16px;">{p.replace(chr(10), "<br>")}</p>' for p in paras
    )


# ─── Audiences ───────────────────────────────────────────────────────────────

MAX_AUDIENCE = 5000

SEGMENTS: dict[str, str] = {
    "all": "All active members",
    "plan": "By plan",
    "verification": "By verification status",
    "gender": "By gender",
    "country": "By country",
    "incomplete": "Incomplete profiles",
    "expiring": "Subscriptions expiring soon",
    "tag": "By CRM tag",
    "follow_up_due": "Follow-ups due",
}

VERIFICATION_STATES = ("draft", "submitted", "approved", "rejected")

DO_NOT_CONTACT = "Do not contact"
SUGGESTED_TAGS = ["VIP", "Follow up", "Called", "Hot lead", "Paid", "Needs photos", "Family contact", DO_NOT_CONTACT]


def _parse_ids(raw: Any) -> list[uuid.UUID]:
    if not isinstance(raw, list) or not raw:
        raise HTTPException(status_code=400, detail="user_ids must be a non-empty list")
    if len(raw) > MAX_AUDIENCE:
        raise HTTPException(status_code=400, detail=f"Selections are capped at {MAX_AUDIENCE} members")
    out: list[uuid.UUID] = []
    for r in raw:
        try:
            out.append(uuid.UUID(str(r)))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"invalid user_id {r!r}")
    return out


def describe_audience(audience: dict[str, Any]) -> str:
    t = audience.get("type")
    if t == "users":
        n = len(audience.get("user_ids") or [])
        return f"{n} selected member{'s' if n != 1 else ''}"
    seg = audience.get("segment") or "all"
    val = audience.get("value")
    if seg == "plan" and val:
        return f"Plan: {plan_label(str(val))}"
    if seg == "verification" and val:
        return f"Verification: {str(val).capitalize()}"
    if seg == "gender" and val:
        return f"Gender: {str(val).capitalize()}"
    if seg == "country" and val:
        return f"Country: {val}"
    if seg == "tag" and val:
        return f"Tag: {val}"
    if seg == "expiring":
        return f"Subscriptions expiring within {val or 14} days"
    return SEGMENTS.get(seg, seg)


def build_audience_query(tenant_uuid: uuid.UUID, audience: dict[str, Any]) -> Select:
    """
    Tenant-scoped SELECT (User, UserProfile) for an audience spec:

      {"type": "users",   "user_ids": [...]}
      {"type": "segment", "segment": "<key in SEGMENTS>", "value": "..."}

    Deleted members are always excluded. Segments also exclude suspended
    members; an explicit selection keeps them (the admin chose them on purpose).
    """
    if not isinstance(audience, dict):
        raise HTTPException(status_code=400, detail="audience must be an object")

    q = (
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.tenant_id == tenant_uuid, User.deleted_at.is_(None))
    )

    t = audience.get("type")
    if t == "users":
        return q.where(User.id.in_(_parse_ids(audience.get("user_ids"))))
    if t != "segment":
        raise HTTPException(status_code=400, detail="audience.type must be 'users' or 'segment'")

    q = q.where(User.is_active == True)  # noqa: E712
    # Members an admin tagged "Do not contact" never receive segment sends.
    q = q.where(User.id.not_in(
        select(UserCrmProfile.user_id).where(
            UserCrmProfile.tenant_id == tenant_uuid,
            UserCrmProfile.deleted_at.is_(None),
            cast(UserCrmProfile.tags, JSONB).contains([DO_NOT_CONTACT]),
        )
    ))
    seg = (audience.get("segment") or "all").strip()
    val = audience.get("value")
    val_s = str(val).strip() if val is not None else ""

    if seg == "all":
        return q
    if seg == "plan":
        try:
            tier = SubscriptionTier(val_s.lower())
        except ValueError:
            raise HTTPException(status_code=400, detail="plan must be one of free, silver, gold, platinum")
        return q.where(User.subscription_tier == tier)
    if seg == "verification":
        if val_s not in VERIFICATION_STATES:
            raise HTTPException(status_code=400, detail=f"verification must be one of {', '.join(VERIFICATION_STATES)}")
        if val_s == "draft":
            return q.where(or_(UserProfile.verification_status == "draft", UserProfile.id.is_(None)))
        return q.where(UserProfile.verification_status == val_s)
    if seg == "gender":
        try:
            g = Gender(val_s.lower())
        except ValueError:
            raise HTTPException(status_code=400, detail="gender must be male, female or other")
        return q.where(UserProfile.gender == g)
    if seg == "country":
        if not val_s:
            raise HTTPException(status_code=400, detail="country is required")
        return q.where(func.lower(func.trim(UserProfile.country)) == val_s.lower())
    if seg == "incomplete":
        return q.where(or_(User.is_profile_complete == False, UserProfile.id.is_(None)))  # noqa: E712
    if seg == "expiring":
        try:
            days = max(1, min(90, int(val_s or 14)))
        except ValueError:
            days = 14
        now = datetime.utcnow()
        sub_ids = select(Subscription.user_id).where(
            Subscription.tenant_id == tenant_uuid,
            Subscription.deleted_at.is_(None),
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.current_period_end >= now,
            Subscription.current_period_end <= now + timedelta(days=days),
        )
        return q.where(User.id.in_(sub_ids))
    if seg == "tag":
        if not val_s:
            raise HTTPException(status_code=400, detail="tag is required")
        tagged = select(UserCrmProfile.user_id).where(
            UserCrmProfile.tenant_id == tenant_uuid,
            UserCrmProfile.deleted_at.is_(None),
            cast(UserCrmProfile.tags, JSONB).contains([val_s]),
        )
        return q.where(User.id.in_(tagged))
    if seg == "follow_up_due":
        due = select(UserCrmProfile.user_id).where(
            UserCrmProfile.tenant_id == tenant_uuid,
            UserCrmProfile.deleted_at.is_(None),
            UserCrmProfile.follow_up_at.is_not(None),
            UserCrmProfile.follow_up_at <= date.today(),
        )
        return q.where(User.id.in_(due))

    raise HTTPException(status_code=400, detail=f"Unknown segment '{seg}'")


def clean_tags(raw: Any) -> list[str]:
    """Trim, de-duplicate (case-insensitive) and cap tag lists."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="tags must be a list of strings")
    out: list[str] = []
    seen: set[str] = set()
    for t in raw:
        s = re.sub(r"\s+", " ", str(t or "")).strip()[:40]
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out[:20]
