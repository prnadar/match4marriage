"""
Application configuration using pydantic-settings.
All values sourced from environment variables — 12-factor compliant.
"""
from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, EmailStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    SECRET_KEY: str = "dev-only-replace-in-prod"

    # ── App ──────────────────────────────────────────────────────────────
    APP_NAME: str = "Match4Marriage API"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: str = "http://localhost:3000,https://match4marriage.com,https://www.match4marriage.com"
    # Used for absolute links in transactional emails. Override in production.
    FRONTEND_URL: str = "http://localhost:3000"

    # ── Database ─────────────────────────────────────────────────────────
    # Defaults to a local SQLite file for development. In production this
    # must be overridden via env var to a managed Postgres URL — the
    # `_check_production_secrets` validator below enforces that.
    DATABASE_URL: str = "sqlite+aiosqlite:///./match4marriage_dev.db"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30

    # ── Redis ────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"

    # ── Auth0 ────────────────────────────────────────────────────────────
    AUTH0_DOMAIN: str = ""
    AUTH0_CLIENT_ID: str = ""
    AUTH0_CLIENT_SECRET: str = ""
    AUTH0_AUDIENCE: str = ""

    # ── Firebase Admin ───────────────────────────────────────────────────
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CLIENT_EMAIL: str = ""
    FIREBASE_PRIVATE_KEY: str = ""

    # ── AWS / S3 (legacy) ──────────────────────────────────────────────
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = "match4marriage-media-dev"
    AWS_REGION: str = "ap-south-1"
    AWS_CLOUDFRONT_DOMAIN: str = ""

    # ── Cloudinary ──────────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_UPLOAD_FOLDER: str = "match4marriage"

    # Payments: PayPal only. Credentials are admin-managed per tenant in
    # payment_gateway_configs (not env vars), so nothing lives here.

    # ── Twilio ───────────────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    TWILIO_WHATSAPP_NUMBER: str = ""

    # ── AI / ML ──────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX: str = "match4marriage-profiles"

    # ── VedAstro (Kundali matching) ──────────────────────────────────────
    VEDASTRO_API_KEY: str = "FreeAPIUser"

    # ── Email ────────────────────────────────────────────────────────────
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: EmailStr = "hello@match4marriage.com"  # type: ignore[assignment]

    # ── Multi-tenancy / White-label ───────────────────────────────────────
    DEFAULT_TENANT_SLUG: str = "match4marriage"
    TENANT_HEADER: str = "X-Tenant-ID"

    # ── Rate limiting ────────────────────────────────────────────────────
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_AUTH: str = "10/minute"

    # ── OTP ──────────────────────────────────────────────────────────────
    OTP_EXPIRY_SECONDS: int = 300
    OTP_LENGTH: int = 6

    # ── Demo Mode ────────────────────────────────────────────────────────
    # When DEMO_MODE=true, OTP "000000" is always accepted (for client demos).
    # Production validator below explicitly forbids this in production.
    DEMO_MODE: bool = False

    # ── Bootstrap admin emails ────────────────────────────────────────────
    # Comma-separated list of email addresses that get auto-promoted to admin
    # the first time they sign in. Saves having to hand-run SQL on a fresh
    # production deploy. Auto-marks email + phone verified so the (app) gate
    # doesn't bounce the bootstrap admin to /onboarding either.
    # Example: BOOTSTRAP_ADMIN_EMAILS=founder@m4m.com,ops@m4m.com
    BOOTSTRAP_ADMIN_EMAILS: str = ""

    # ── Celery ───────────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ── Subscription plans ────────────────────────────────────────────────
    # The internal DB tier names (silver / gold / platinum on
    # SubscriptionTier enum) map to the customer-facing names
    # Basic / Premium / Elite. Prices are stored in the smallest currency
    # unit (pence for GBP, paise for INR) so they can be passed straight
    # to Stripe / Razorpay. Override these via env in production if the
    # marketing prices change.
    #
    #   silver   → "Basic Plan"     → £100 / 6 months    (~₹10,500)
    #   gold     → "Premium Plan"   → £300 / 6 months    (~₹31,500)
    #   platinum → "Elite Plan"     → £1,000 / 6 months  (~₹105,000)
    # Fallback prices (pence) used only if a plan has no active DB row.
    # The source of truth is the admin-managed pricing_plans table.
    SILVER_PRICE_GBP: int = 10000     # £100.00
    GOLD_PRICE_GBP: int = 30000       # £300.00
    PLATINUM_PRICE_GBP: int = 100000  # £1,000.00

    # ── Production safety ────────────────────────────────────────────────
    # Refuses to start the API with truly catastrophic defaults when
    # ENVIRONMENT is "production". Only the *non-recoverable* problems
    # block boot here:
    #   - SECRET_KEY left as the dev placeholder (sessions forgeable)
    #   - DATABASE_URL still pointing at SQLite (data lost on redeploy)
    #   - DEMO_MODE accidentally enabled (OTP "000000" accepted)
    #
    # REDIS_URL pointing at localhost is *warned* rather than blocked —
    # rate-limiting degrades gracefully when the broker is unreachable
    # and the API can serve real users without it. Same for the other
    # external services (Cloudinary, Stripe, etc.); each fails loudly at
    # the call-site rather than at startup so the rest of the app can
    # boot.
    @model_validator(mode="after")
    def _check_production_secrets(self) -> "Settings":
        if self.ENVIRONMENT != "production":
            return self
        problems: list[str] = []
        if self.SECRET_KEY in {"", "dev-only-replace-in-prod"}:
            problems.append("SECRET_KEY is unset or still the dev placeholder")
        if self.DATABASE_URL.startswith("sqlite"):
            problems.append("DATABASE_URL is still pointing at SQLite — set a Postgres URL")
        if self.DEMO_MODE:
            problems.append("DEMO_MODE is enabled — OTP '000000' would be accepted in production")
        if self.FRONTEND_URL.startswith("http://localhost") or self.FRONTEND_URL.startswith("http://127."):
            problems.append(
                "FRONTEND_URL still points at localhost — PayPal would send paying "
                "buyers to your dev machine on return. Set FRONTEND_URL to the "
                "production frontend origin (e.g. https://match4marriage.com)."
            )
        if not self.FRONTEND_URL.startswith("https://"):
            problems.append("FRONTEND_URL must use https:// in production")
        if not self.ALLOWED_ORIGINS or "localhost" in self.ALLOWED_ORIGINS:
            problems.append(
                "ALLOWED_ORIGINS must be set to your production origin(s) "
                "(comma-separated). Localhost is not permitted in production."
            )
        if problems:
            raise ValueError(
                "Refusing to start in production with insecure config:\n  - "
                + "\n  - ".join(problems)
            )
        # Soft warnings — don't block boot
        import logging
        log = logging.getLogger("app.config")
        if "localhost" in self.REDIS_URL or "127.0.0.1" in self.REDIS_URL:
            log.warning(
                "REDIS_URL is pointing at localhost in production. "
                "Rate limiting and Celery will not work until a managed "
                "Redis URL is configured.",
            )
        return self

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse ALLOWED_ORIGINS string into a list for CORS middleware."""
        v = self.ALLOWED_ORIGINS.strip()
        if v.startswith("["):
            import json
            try:
                return json.loads(v)
            except Exception:
                pass
        return [o.strip() for o in v.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def media_base_url(self) -> str:
        if self.AWS_CLOUDFRONT_DOMAIN:
            return f"https://{self.AWS_CLOUDFRONT_DOMAIN}"
        return f"https://{self.AWS_S3_BUCKET}.s3.{self.AWS_REGION}.amazonaws.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
