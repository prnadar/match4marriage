"""
Bot / spam detection for the public enquiry form.

Two tiers:
- `is_certain_bot(...)`  — signals no human produces (hidden honeypot field
  filled in, form submitted faster than a person can type). These are dropped
  silently: the bot gets the normal success response and nothing is stored.
- `spam_reason(...)`     — content heuristics. Anything that trips one is kept
  but filed under status SPAM (no team email), so staff can restore a false
  positive with "Not spam".

Deliberately conservative: real enquiries come from families writing in
English, Tamil, Hindi and other Indian scripts, so non-Latin text is never
penalised except Cyrillic, which is a strong bot signal for this audience.
"""
import re

_URL_RE = re.compile(r"(https?://|www\.)\S+", re.IGNORECASE)
_BBCODE_RE = re.compile(r"\[(url|link)[=\]]", re.IGNORECASE)
_CYRILLIC_RE = re.compile(r"[Ѐ-ӿ]")
_LETTER_RE = re.compile(r"[^\W\d_]", re.UNICODE)

# Phrases that, for a matrimony bureau's contact form, are almost always pitches.
_SPAM_PHRASES = (
    "seo", "backlink", "search engine optim", "rank your website", "first page of google",
    "google ranking", "guest post", "web design", "website design", "web development",
    "digital marketing", "lead generation", "crypto", "bitcoin", "forex", "casino",
    "betting", "viagra", "cialis", "loan offer", "payday loan", "adult content", "porn",
    "onlyfans", "telegram @", "whatsapp me for", "investment opportunity", "make money",
    "work from home", "earn $", "click here", "unsubscribe from this", "dear website owner",
    "dear business owner", "i came across your website", "increase your traffic",
)

MIN_HUMAN_FILL_MS = 2500


def is_certain_bot(honeypot: str | None, elapsed_ms: object) -> str | None:
    """Return a reason if the submission is certainly automated, else None."""
    if honeypot and str(honeypot).strip():
        return "honeypot"
    if elapsed_ms is not None:
        try:
            ms = int(elapsed_ms)
        except (TypeError, ValueError):
            return None  # malformed timing — don't penalise, other checks apply
        if 0 <= ms < MIN_HUMAN_FILL_MS:
            return "too_fast"
    return None


def spam_reason(name: str, email: str | None, subject: str | None, message: str) -> str | None:
    """Return a short human-readable reason if the content looks like spam."""
    name_l = (name or "").lower()
    text = f"{subject or ''}\n{message or ''}"
    text_l = text.lower()

    if _URL_RE.search(name_l) or "http" in name_l:
        return "Link in the name field"
    if _BBCODE_RE.search(text):
        return "Forum link markup"
    links = len(_URL_RE.findall(text))
    if links >= 3:
        return f"{links} links in the message"

    letters = _LETTER_RE.findall(text)
    if len(letters) >= 20:
        cyr = len(_CYRILLIC_RE.findall(text))
        if cyr / len(letters) > 0.3:
            return "Mostly Cyrillic text"

    hits = [p for p in _SPAM_PHRASES if p in text_l]
    if hits and (links >= 1 or len(hits) >= 2):
        return "Sales pitch: " + ", ".join(hits[:3])

    if email and email.split("@")[-1] in {"mail.ru", "yandex.ru", "bk.ru", "list.ru", "inbox.ru"} and links:
        return "Link from a known bot mail domain"
    return None
