"""
OTP service — generate, store in Redis, validate.
Uses Twilio for SMS delivery.

DEMO MODE: When DEMO_MODE=true env var is set, OTP "000000" is always stored
and always accepted — allows client demos without a verified Twilio number.
DEMO_MODE is REJECTED at boot in production (see _check_production_secrets in
core/config.py), so this only runs in dev/staging.
"""
import secrets

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.redis import get_redis

settings = get_settings()
logger = get_logger(__name__)

OTP_KEY_PREFIX = "otp:"
DEMO_OTP = "000000"


def _make_otp() -> str:
    # secrets.randbelow is crypto-secure; random.choices was not.
    n = settings.OTP_LENGTH
    return f"{secrets.randbelow(10 ** n):0{n}d}"


def _redis_key(phone: str, tenant_slug: str) -> str:
    return f"{OTP_KEY_PREFIX}{tenant_slug}:{phone}"


class OTPSendError(RuntimeError):
    """Raised when SMS dispatch fails so callers can surface a real error
    instead of silently flipping into a demo-OTP fallback."""


async def send_otp(phone: str, country_code: str, tenant_slug: str) -> bool:
    """Generate OTP, store in Redis, send via Twilio SMS.

    In DEMO_MODE (dev only), always stores "000000" so the demo user can log
    in with that code regardless of whether Twilio is configured.

    On real SMS failure this raises OTPSendError — it does NOT silently store
    the demo OTP. The previous fallback meant a Twilio outage / misconfig was
    indistinguishable from a real send and let anyone log in as anyone using
    "000000". That was a launch-blocking auth bypass.
    """
    redis = await get_redis()
    key = _redis_key(phone, tenant_slug)

    if settings.DEMO_MODE:
        await redis.setex(key, settings.OTP_EXPIRY_SECONDS, DEMO_OTP)
        logger.warning("demo_mode_otp_stored", phone=phone[-4:], tenant=tenant_slug)
        full_number = f"{country_code}{phone}"
        try:
            _send_sms(full_number, DEMO_OTP)
        except Exception as exc:
            logger.warning("demo_mode_sms_skipped", phone=phone[-4:], error=str(exc))
        return True

    otp = _make_otp()
    full_number = f"{country_code}{phone}"
    try:
        _send_sms(full_number, otp)
    except Exception as exc:
        logger.error("otp_send_failed", phone=phone[-4:], error=str(exc))
        # Don't leave a stale OTP around for a previous send.
        try:
            await redis.delete(key)
        except Exception:
            pass
        raise OTPSendError("Could not send verification code. Please try again in a moment.") from exc

    # Only persist after successful send.
    await redis.setex(key, settings.OTP_EXPIRY_SECONDS, otp)
    logger.info("otp_sent", phone=phone[-4:], tenant=tenant_slug)
    return True


def _send_sms(phone: str, otp: str) -> None:
    """Send SMS via Twilio. Raises on failure.

    In dev, when Twilio isn't configured we log the OTP for the developer.
    In production this code path is unreachable: _check_production_secrets
    refuses to boot if TWILIO_ACCOUNT_SID is empty AND DEMO_MODE is false.
    """
    if not settings.TWILIO_ACCOUNT_SID:
        if settings.is_production:
            # Production must have Twilio. Treat unconfigured as a real failure
            # so the caller surfaces it instead of silently swallowing it.
            raise RuntimeError("Twilio is not configured in production")
        logger.warning("twilio_not_configured_dev_otp", otp=otp)
        return

    from twilio.rest import Client  # type: ignore[import-untyped]

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    client.messages.create(
        body=f"Your Match4Marriage verification code is {otp}. Valid for {settings.OTP_EXPIRY_SECONDS // 60} minutes.",
        from_=settings.TWILIO_PHONE_NUMBER,
        to=phone,
    )


async def verify_otp(phone: str, otp: str, tenant_slug: str) -> bool:
    """Validate OTP. Deletes key on success (one-time use).

    In DEMO_MODE, "000000" is accepted; outside DEMO_MODE only the Redis-stored
    value is accepted. We increment a per-phone failure counter on mismatch so
    a brute-force attempt gets a 10-minute lockout after 5 wrong tries.
    """
    if settings.DEMO_MODE and otp == DEMO_OTP:
        logger.warning("demo_mode_otp_accepted", phone=phone[-4:], tenant=tenant_slug)
        redis = await get_redis()
        await redis.delete(_redis_key(phone, tenant_slug))
        return True

    redis = await get_redis()
    key = _redis_key(phone, tenant_slug)

    # Anti-brute-force lockout — 5 wrong attempts in 10 minutes blocks the
    # phone until the lock expires. Real users will request a new OTP.
    attempts_key = f"otp:attempts:{tenant_slug}:{phone}"
    try:
        attempts = int(await redis.get(attempts_key) or 0)
    except Exception:
        attempts = 0
    if attempts >= 5:
        logger.warning("otp_locked_too_many_attempts", phone=phone[-4:])
        return False

    stored = await redis.get(key)
    if stored is None:
        logger.info("otp_expired_or_not_found", phone=phone[-4:])
        return False

    if stored != otp:
        # Bump counter on any mismatch.
        try:
            await redis.incr(attempts_key)
            await redis.expire(attempts_key, settings.OTP_EXPIRY_SECONDS)
        except Exception:
            pass
        logger.info("otp_mismatch", phone=phone[-4:])
        return False

    # Success — clear OTP + attempts counter.
    await redis.delete(key)
    try:
        await redis.delete(attempts_key)
    except Exception:
        pass
    logger.info("otp_verified", phone=phone[-4:], tenant=tenant_slug)
    return True
