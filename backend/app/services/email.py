"""
Email service — transactional emails via Resend API.

All functions are async-compatible via asyncio.to_thread so the
FastAPI event loop is never blocked by the synchronous HTTP call.
"""
import asyncio
import logging
from typing import Any

import resend

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)


def _configure_resend() -> None:
    """Set the Resend API key (idempotent)."""
    resend.api_key = settings.RESEND_API_KEY


# ── Low-level helper ──────────────────────────────────────────────────────────


def _resend_post(
    to_email: str,
    to_name: str,
    subject: str,
    html_content: str,
    plain_content: str = "",
    extra: dict[str, Any] | None = None,
) -> bool:
    """
    Synchronous call to Resend emails.send.
    Returns True on success, False otherwise.
    Runs inside asyncio.to_thread to keep the event loop free.
    """
    if not settings.RESEND_API_KEY:
        logger.warning("resend_api_key_missing — email not sent")
        return False

    _configure_resend()
    from_email = str(settings.RESEND_FROM_EMAIL)

    params: dict[str, Any] = {
        "from": f"Match4Marriage <{from_email}>",
        "to": [to_email],
        "subject": subject,
        "html": html_content,
        "text": plain_content or _html_to_plain(html_content),
    }
    if extra and extra.get("reply_to"):
        params["reply_to"] = extra["reply_to"]

    try:
        email = resend.Emails.send(params)
        logger.info(
            "email_sent",
            to=to_email,
            subject=subject,
            id=email.get("id"),
        )
        return True
    except Exception as exc:
        logger.error("resend_error", error=str(exc), to=to_email)
        return False


def _html_to_plain(html: str) -> str:
    """Very minimal HTML → plaintext strip for fallback plain part."""
    import re
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Account & security emails (password reset, email change, notices) ────────
#
# Used by app/routers/auth.py. Kept together so the account-security mail all
# shares one branded shell.


def _account_email_shell(
    heading: str,
    body_html: str,
    footnote: str = "",
    footer: str = "This is an automated security message.",
) -> str:
    """Branded shell for account/security emails (same palette as verification)."""
    import html as _html
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{_html.escape(heading)}</title></head>
<body style="font-family: Arial, sans-serif; background: #f9f6f1; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f1; padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff; border-radius:12px; overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#c0392b; padding:32px; text-align:center;">
            <h1 style="color:#ffffff; margin:0; font-size:24px; letter-spacing:1px;">Match4Marriage</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="font-size:19px; color:#222222; margin:0 0 18px;">{_html.escape(heading)}</h2>
            {body_html}
            {f'<p style="font-size:13px; color:#888888; line-height:1.5; margin:24px 0 0;">{footnote}</p>' if footnote else ''}
          </td>
        </tr>
        <tr>
          <td style="background:#f4f0ec; padding:20px 40px; text-align:center;">
            <p style="margin:0; font-size:12px; color:#aaaaaa;">
              &copy; Match4Marriage &middot; {footer}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


async def send_password_reset_email(
    email: str,
    reset_url: str,
    user_name: str,
    expires_minutes: int = 60,
    subject: str | None = None,
    html_override: str | None = None,
    text_override: str | None = None,
) -> bool:
    """
    Send a password-reset link. `subject` / `html_override` / `text_override`
    let the caller supply an admin-managed `password_reset` mail template
    (already rendered); otherwise the built-in branded copy is used.
    """
    import html as _html
    safe_name = _html.escape(user_name or "there")
    safe_url = _html.escape(reset_url, quote=True)
    subj = subject or "Reset your Match4Marriage password"
    if html_override and "<html" not in html_override.lower():
        # Admin templates are usually body fragments — wrap in the house shell.
        html_override = _account_email_shell("Reset your password", html_override)
    html = html_override or _account_email_shell(
        "Reset your password",
        f"""
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 16px;">Hello {safe_name},</p>
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 28px;">
              We received a request to reset the password for your Match4Marriage account.
              Choose a new password using the button below.
            </p>
            <p style="text-align:center; margin:0 0 28px;">
              <a href="{safe_url}"
                 style="display:inline-block; background:#c0392b; color:#ffffff; text-decoration:none;
                        font-weight:bold; font-size:15px; padding:14px 30px; border-radius:8px;">
                Choose a new password
              </a>
            </p>
            <p style="font-size:13px; color:#888888; line-height:1.5; margin:0 0 8px;">
              This link expires in {int(expires_minutes)} minutes and can only be used once.
              If the button doesn't work, copy this address into your browser:
            </p>
            <p style="font-size:12px; color:#c0392b; word-break:break-all; margin:0;">{safe_url}</p>
        """,
        footnote="If you didn't ask to reset your password, you can safely ignore this email. "
                 "Your password won't change.",
    )
    plain = text_override or (
        f"Hello {user_name or 'there'},\n\n"
        "We received a request to reset your Match4Marriage password.\n"
        f"Choose a new password here (expires in {int(expires_minutes)} minutes, single use):\n\n"
        f"{reset_url}\n\n"
        "If you didn't ask for this, ignore this email. Your password won't change."
    )
    return await asyncio.to_thread(_resend_post, email, user_name, subj, html, plain)


async def send_email_change_code(email: str, token: str, user_name: str) -> bool:
    """Send a 6-digit code to a NEW email address to confirm an email change."""
    import html as _html
    safe_name = _html.escape(user_name or "there")
    html = _account_email_shell(
        "Confirm your new email address",
        f"""
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 16px;">Hello {safe_name},</p>
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 24px;">
              You asked to use this address for your Match4Marriage account.
              Enter the code below in Settings to confirm the change.
            </p>
            <div style="background:#f4f0ec; border-radius:8px; padding:24px; text-align:center; margin:0 0 8px;">
              <span style="font-size:36px; font-weight:bold; color:#c0392b; letter-spacing:6px;">{_html.escape(token)}</span>
              <p style="margin:12px 0 0; font-size:12px; color:#aaaaaa;">Expires in 10 minutes</p>
            </div>
        """,
        footnote="If you didn't request this, ignore this email. Your account email won't change. "
                 "Never share this code with anyone.",
    )
    plain = (
        f"Hello {user_name or 'there'},\n\n"
        f"Your Match4Marriage email-change code is: {token}\n\n"
        "It expires in 10 minutes. If you didn't request this, ignore this email."
    )
    return await asyncio.to_thread(
        _resend_post, email, user_name, "Confirm your new Match4Marriage email", html, plain
    )


async def send_member_activity_email(
    email: str,
    recipient_name: str,
    *,
    subject: str,
    heading: str,
    message: str,
    cta_label: str,
    cta_path: str,
) -> bool:
    """Member-to-member activity (new interest, accepted interest, new
    message). All text is plain and escaped here; `cta_path` is a site path.
    Senders must check member_wants_email() first."""
    import html as _html
    href = f"{settings.FRONTEND_URL.rstrip('/')}{cta_path}"
    prefs = f"{settings.FRONTEND_URL.rstrip('/')}/settings?section=notifications"
    html = _account_email_shell(
        heading,
        f"""
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 16px;">Hello {_html.escape(recipient_name or "there")},</p>
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 24px;">{_html.escape(message)}</p>
            <a href="{_html.escape(href)}"
               style="display:inline-block; background:#c0392b; color:#ffffff; font-size:15px;
                      font-weight:bold; padding:13px 28px; border-radius:6px; text-decoration:none;">
              {_html.escape(cta_label)} &rarr;
            </a>
        """,
        footnote=f'You can choose which emails you receive in <a href="{_html.escape(prefs)}" '
                 'style="color:#c0392b;">Settings → Notifications</a>.',
        footer="You're receiving this because you're a Match4Marriage member.",
    )
    plain = (
        f"Hello {recipient_name or 'there'},\n\n{message}\n\n{cta_label}: {href}\n\n"
        f"Manage your email preferences: {prefs}\n"
    )
    return await asyncio.to_thread(_resend_post, email, recipient_name, subject, html, plain)


async def send_security_notice_email(email: str, user_name: str, title: str, message: str) -> bool:
    """
    Short "something changed on your account" notice (password changed, email
    changed, account deactivated/deleted). `message` is plain text.
    """
    import html as _html
    safe_name = _html.escape(user_name or "there")
    html = _account_email_shell(
        title,
        f"""
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 16px;">Hello {safe_name},</p>
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0;">{_html.escape(message)}</p>
        """,
        footnote="If this wasn't you, reset your password straight away and reply to this email "
                 "so our team can secure your account.",
    )
    plain = (
        f"Hello {user_name or 'there'},\n\n{message}\n\n"
        "If this wasn't you, reset your password straight away and reply to this email."
    )
    return await asyncio.to_thread(_resend_post, email, user_name, f"Match4Marriage: {title}", html, plain)


# ── Public async API ──────────────────────────────────────────────────────────


async def send_verification_email(
    email: str,
    token: str,
    user_name: str,
) -> bool:
    """
    Send a 6-character email verification token to the user.

    Args:
        email:     recipient email address
        token:     6-char alphanumeric OTP
        user_name: display name for personalisation

    Returns True on delivery success, False otherwise.
    """
    subject = "Verify your Match4Marriage email address"

    html = f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background: #f9f6f1; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f1; padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff; border-radius:12px; overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#c0392b; padding:32px; text-align:center;">
            <h1 style="color:#ffffff; margin:0; font-size:24px; letter-spacing:1px;">
              Match4Marriage
            </h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="font-size:16px; color:#333333; margin:0 0 16px;">
              Hello {user_name},
            </p>
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 24px;">
              Thank you for joining Match4Marriage, your trusted partner in finding a life partner
              within the UK Indian community. Please verify your email address using the code below.
            </p>
            <!-- Token box -->
            <div style="background:#f4f0ec; border-radius:8px; padding:24px; text-align:center;
                        margin:0 0 28px;">
              <p style="margin:0 0 8px; font-size:13px; color:#888888; text-transform:uppercase;
                         letter-spacing:1px;">Your verification code</p>
              <span style="font-size:36px; font-weight:bold; color:#c0392b; letter-spacing:6px;">
                {token}
              </span>
              <p style="margin:12px 0 0; font-size:12px; color:#aaaaaa;">
                Expires in 10 minutes
              </p>
            </div>
            <p style="font-size:13px; color:#888888; line-height:1.5;">
              If you did not create an account on Match4Marriage, please ignore this email.
              Never share this code with anyone.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f4f0ec; padding:20px 40px; text-align:center;">
            <p style="margin:0; font-size:12px; color:#aaaaaa;">
              &copy; 2025 Match4Marriage &middot; All rights reserved
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    plain = (
        f"Hello {user_name},\n\n"
        f"Your Match4Marriage email verification code is: {token}\n\n"
        "This code expires in 10 minutes.\n\n"
        "If you did not create an account, please ignore this email."
    )

    return await asyncio.to_thread(
        _resend_post, email, user_name, subject, html, plain
    )


async def send_welcome_email(
    email: str,
    user_name: str,
) -> bool:
    """
    Send a welcome email after a user completes email verification.

    Args:
        email:     recipient email address
        user_name: display name

    Returns True on delivery success, False otherwise.
    """
    subject = "Welcome to Match4Marriage, your journey begins"

    html = f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background: #f9f6f1; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f1; padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff; border-radius:12px; overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#c0392b; padding:32px; text-align:center;">
            <h1 style="color:#ffffff; margin:0; font-size:24px; letter-spacing:1px;">
              Match4Marriage
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="font-size:16px; color:#333333; margin:0 0 16px;">
              Welcome, {user_name}!
            </p>
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 20px;">
              Your email has been verified. You're now a verified member of Match4Marriage,
              the most trusted matrimonial platform for the UK Indian community.
            </p>
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 28px;">
              Here's what to do next:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#fdf8f4; border-left:4px solid #c0392b; padding:14px 18px;
                            border-radius:4px; margin-bottom:12px;">
                  <strong style="color:#333;">1. Complete your profile</strong>
                  <p style="margin:4px 0 0; font-size:13px; color:#777;">
                    Profiles with photos get 8&times; more responses.
                  </p>
                </td>
              </tr>
              <tr><td style="height:10px;"></td></tr>
              <tr>
                <td style="background:#fdf8f4; border-left:4px solid #c0392b; padding:14px 18px;
                            border-radius:4px;">
                  <strong style="color:#333;">2. Explore daily matches</strong>
                  <p style="margin:4px 0 0; font-size:13px; color:#777;">
                    We curate 5 compatible matches for you every morning.
                  </p>
                </td>
              </tr>
            </table>
            <p style="font-size:13px; color:#888888;">
              Wishing you all the very best on your journey.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f0ec; padding:20px 40px; text-align:center;">
            <p style="margin:0; font-size:12px; color:#aaaaaa;">
              &copy; 2025 Match4Marriage &middot; All rights reserved
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    plain = (
        f"Welcome, {user_name}!\n\n"
        "Your email has been verified. You are now a verified member of Match4Marriage.\n\n"
        "Next steps:\n"
        "1. Complete your profile. Profiles with photos get 8x more responses.\n"
        "2. Explore your daily matches. We curate 5 compatible profiles every morning.\n\n"
        "Wishing you all the very best on your journey.\n\n"
        "The Match4Marriage Team"
    )

    return await asyncio.to_thread(
        _resend_post, email, user_name, subject, html, plain
    )


async def send_membership_welcome_email(
    email: str,
    user_name: str,
    membership_number: str,
) -> bool:
    """
    Send the post-onboarding welcome email that confirms the user's
    new membership number. Triggered once the ID verification step is
    submitted — that's the moment we consider onboarding "complete".
    """
    subject = f"Welcome to Match4Marriage. Your membership number is {membership_number}"

    html = f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background: #f9f6f1; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f1; padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff; border-radius:12px; overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a0a14; padding:32px; text-align:center;">
            <h1 style="color:#ffffff; margin:0; font-size:24px; letter-spacing:1px;">
              Match4Marriage
            </h1>
            <p style="color:rgba(255,255,255,0.7); margin:6px 0 0; font-size:12px; letter-spacing:2px; text-transform:uppercase;">
              Welcome to the family
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="font-size:16px; color:#333333; margin:0 0 16px;">
              Welcome, {user_name}.
            </p>
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 24px;">
              Your onboarding is complete. From today, you are a Match4Marriage
              member, and one of our advisors will reach out shortly to walk
              you through your next steps.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#fdf8f4; border:1px solid #f0e0e5; border-radius:8px; padding:20px 24px; text-align:center;">
                  <p style="margin:0 0 8px; font-size:11px; color:#a78a8f; letter-spacing:2px; text-transform:uppercase; font-weight:700;">
                    Your membership number
                  </p>
                  <p style="margin:0; font-family:'Georgia', serif; font-size:24px; color:#1a0a14; letter-spacing:2px; font-weight:600;">
                    {membership_number}
                  </p>
                </td>
              </tr>
            </table>

            <p style="font-size:14px; color:#555555; line-height:1.6; margin:0 0 8px;">
              Please keep this number safe. Quote it whenever you contact us,
              by email, on the phone, or on WhatsApp, and we'll find your
              records straight away.
            </p>
            <p style="font-size:13px; color:#888888; margin:24px 0 0;">
              Wishing you all the very best on your journey.<br>
              The Match4Marriage Team
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f0ec; padding:20px 40px; text-align:center;">
            <p style="margin:0; font-size:12px; color:#aaaaaa;">
              &copy; Match4Marriage &middot; All rights reserved
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    plain = (
        f"Welcome, {user_name}.\n\n"
        "Your onboarding is complete. From today, you are a Match4Marriage member.\n\n"
        f"Your membership number: {membership_number}\n\n"
        "Please keep this number safe. Quote it whenever you contact us and we'll "
        "find your records straight away.\n\n"
        "The Match4Marriage Team"
    )

    return await asyncio.to_thread(
        _resend_post, email, user_name, subject, html, plain
    )


ENQUIRY_INBOX = "enquiry@match4marriage.com"


async def send_enquiry_notification_email(
    *,
    name: str,
    sender_email: str | None,
    phone: str | None,
    subject: str | None,
    message: str,
) -> bool:
    """
    Notify the team inbox (enquiry@match4marriage.com) of a new contact-form
    submission. Reply-To is set to the enquirer so a reply goes straight back
    to them.
    """
    subj = f"New enquiry: {subject}" if subject else f"New enquiry from {name}"

    def esc(s: str) -> str:
        return (
            s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )

    rows = [
        ("Name", name),
        ("Email", sender_email or "—"),
        ("Phone", phone or "—"),
        ("Subject", subject or "—"),
    ]
    rows_html = "".join(
        f'<tr><td style="padding:6px 14px;color:#888;font-size:13px;'
        f'white-space:nowrap;vertical-align:top;">{k}</td>'
        f'<td style="padding:6px 14px;color:#1a0a14;font-size:14px;">{esc(v)}</td></tr>'
        for k, v in rows
    )
    html = f"""
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f9f6f1;margin:0;padding:32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#1a0a14;padding:24px 32px;">
        <h1 style="color:#fff;margin:0;font-size:18px;letter-spacing:1px;">Match4Marriage — New enquiry</h1>
      </td></tr>
      <tr><td style="padding:24px 18px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0">{rows_html}</table>
      </td></tr>
      <tr><td style="padding:8px 32px 28px;">
        <p style="margin:0 0 6px;color:#888;font-size:13px;">Message</p>
        <div style="background:#fdf8f4;border:1px solid #f0e0e5;border-radius:8px;padding:16px;color:#1a0a14;font-size:14px;line-height:1.6;white-space:pre-wrap;">{esc(message)}</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>
"""
    plain = (
        f"New enquiry\n\nName: {name}\nEmail: {sender_email or '—'}\n"
        f"Phone: {phone or '—'}\nSubject: {subject or '—'}\n\nMessage:\n{message}\n"
    )

    extra = {"reply_to": sender_email} if sender_email else None
    return await asyncio.to_thread(
        _resend_post, ENQUIRY_INBOX, "Match4Marriage Enquiries", subj, html, plain, extra
    )


async def send_interest_notification_email(
    email: str,
    from_name: str,
    recipient_name: str = "there",
) -> bool:
    """
    Notify a user that someone has expressed interest in their profile.

    Args:
        email:          recipient email address
        from_name:      display name of the person who sent the interest
        recipient_name: display name of the recipient (defaults to "there")

    Returns True on delivery success, False otherwise.
    """
    subject = f"{from_name} is interested in your profile"
    cta_href = f"{settings.FRONTEND_URL.rstrip('/')}/notifications"

    html = f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background: #f9f6f1; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f1; padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff; border-radius:12px; overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#c0392b; padding:32px; text-align:center;">
            <h1 style="color:#ffffff; margin:0; font-size:24px; letter-spacing:1px;">
              Match4Marriage
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px; text-align:center;">
            <h2 style="color:#c0392b; font-size:22px; margin:0 0 16px;">
              You have a new interest!
            </h2>
            <p style="font-size:15px; color:#555555; line-height:1.6; margin:0 0 24px;">
              Hello {recipient_name},<br><br>
              <strong>{from_name}</strong> has expressed interest in your profile.
              Log in to view their profile and decide if you'd like to connect.
            </p>
            <!-- CTA button -->
            <a href="{cta_href}"
               style="display:inline-block; background:#c0392b; color:#ffffff; font-size:15px;
                      font-weight:bold; padding:14px 32px; border-radius:6px;
                      text-decoration:none; margin:0 0 28px;">
              View Their Profile &rarr;
            </a>
            <p style="font-size:13px; color:#aaaaaa; line-height:1.5;">
              If you're not interested, simply ignore this notification or decline from within the
              app. Your privacy is always respected.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f0ec; padding:20px 40px; text-align:center;">
            <p style="margin:0; font-size:12px; color:#aaaaaa;">
              &copy; 2025 Match4Marriage &middot; All rights reserved
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    plain = (
        f"Hello {recipient_name},\n\n"
        f"{from_name} has expressed interest in your profile on Match4Marriage.\n\n"
        "Log in to view their profile and decide whether you'd like to connect.\n\n"
        "The Match4Marriage Team"
    )

    return await asyncio.to_thread(
        _resend_post, email, recipient_name, subject, html, plain
    )


# ── Admin → member messages (CRM) ─────────────────────────────────────────────
#
# Used by app/routers/admin_crm.py. The admin writes the body (plain text or
# HTML from a mail template); we wrap it in the house email shell. Unlike the
# helpers above these return a detail dict so the communication log can record
# the provider id or the exact failure reason.


def render_admin_message_html(subject: str, body_html: str) -> str:
    """Wrap an admin-authored body in the branded Match4Marriage email shell."""
    import html as _html
    safe_subject = _html.escape(subject or "")
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{safe_subject}</title></head>
<body style="font-family: Arial, sans-serif; background: #f9f6f1; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f1; padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff; border-radius:12px; overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a0a14; padding:26px 32px; text-align:center;">
            <h1 style="color:#ffffff; margin:0; font-size:22px; letter-spacing:1px;">Match4Marriage</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:34px 40px; font-size:15px; color:#444444; line-height:1.65;">
            {body_html}
          </td>
        </tr>
        <tr>
          <td style="background:#f4f0ec; padding:18px 40px; text-align:center;">
            <p style="margin:0; font-size:12px; color:#999999; line-height:1.5;">
              You are receiving this because you are a registered member of Match4Marriage.<br>
              Simply reply to this email to reach our team.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def _admin_send_one(params: dict[str, Any]) -> dict[str, Any]:
    if not settings.RESEND_API_KEY:
        return {"ok": False, "id": None, "error": "Email provider not configured (RESEND_API_KEY is not set)"}
    _configure_resend()
    try:
        res = resend.Emails.send(params)
        return {"ok": True, "id": (res or {}).get("id"), "error": None}
    except Exception as exc:  # provider / network error
        logger.error("admin_email_error", error=str(exc))
        return {"ok": False, "id": None, "error": str(exc)[:500]}


def _admin_params(to_email: str, subject: str, html: str, text: str, reply_to: str | None) -> dict[str, Any]:
    params: dict[str, Any] = {
        "from": f"Match4Marriage <{settings.RESEND_FROM_EMAIL}>",
        "to": [to_email],
        "subject": subject,
        "html": html,
        "text": text or _html_to_plain(html),
    }
    if reply_to:
        params["reply_to"] = reply_to
    return params


async def send_admin_message_email(
    to_email: str,
    subject: str,
    html: str,
    text: str = "",
    reply_to: str | None = None,
) -> dict[str, Any]:
    """Send one admin-authored email. Returns {ok, id, error}."""
    params = _admin_params(to_email, subject, html, text, reply_to)
    return await asyncio.to_thread(_admin_send_one, params)


def _admin_send_batch(chunk: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not settings.RESEND_API_KEY:
        return [{"ok": False, "id": None, "error": "Email provider not configured (RESEND_API_KEY is not set)"} for _ in chunk]
    _configure_resend()
    try:
        res = resend.Batch.send(chunk)  # up to 100 messages per call
        data = (res or {}).get("data") or []
        out = []
        for i in range(len(chunk)):
            mid = data[i].get("id") if i < len(data) and isinstance(data[i], dict) else None
            out.append({"ok": True, "id": mid, "error": None})
        return out
    except Exception as exc:
        logger.error("admin_batch_email_error", error=str(exc), size=len(chunk))
        return [{"ok": False, "id": None, "error": str(exc)[:500]} for _ in chunk]


async def send_admin_batch_emails(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Send many admin-authored emails using Resend's batch endpoint (100 per
    request) so a broadcast to a few thousand members doesn't trip the
    per-second rate limit. Each message: {to, subject, html, text, reply_to}.
    Returns one {ok, id, error} per message, in order.
    """
    results: list[dict[str, Any]] = []
    for i in range(0, len(messages), 100):
        chunk = [
            _admin_params(m["to"], m["subject"], m["html"], m.get("text", ""), m.get("reply_to"))
            for m in messages[i:i + 100]
        ]
        results.extend(await asyncio.to_thread(_admin_send_batch, chunk))
    return results
