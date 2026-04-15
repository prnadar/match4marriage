"""
Bandhan API — FastAPI entrypoint.
All router registration, middleware, and lifespan events here.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import get_settings
from app.core.database import engine
from app.core.logging import configure_logging, get_logger
from app.core.rate_limit import limiter  # shared Redis-backed Limiter
from app.core.redis import close_redis
from app.core.tenancy import TenantMiddleware
from app.models import *  # noqa: F401,F403 — register all models with Alembic
from app.routers import auth, chat, health, matches, notifications, profile, reports
# subscriptions router disabled for launch (razorpay/stripe deps removed)

settings = get_settings()
configure_logging(debug=settings.DEBUG)
logger = get_logger(__name__)


async def _ensure_verification_columns() -> None:
    """Idempotent: add verification workflow columns if missing (Vercel can't run alembic)."""
    from sqlalchemy import text
    stmts = [
        # Verification workflow
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'draft'",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP",
        # Physical
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_kg SMALLINT",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS complexion VARCHAR(50)",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_type VARCHAR(50)",
        # Education / career extras
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education_field VARCHAR(200)",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS college VARCHAR(200)",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employer VARCHAR(200)",
        # Community extras
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sub_caste VARCHAR(200)",
        # Bio / family
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS about_family TEXT",
        # Kundali JSON bucket (stores lifestyle/astro/interests/contact/schools/colleges/employment)
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kundali_data JSONB NOT NULL DEFAULT '{}'::jsonb",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_time VARCHAR(10)",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_place VARCHAR(200)",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_manglik BOOLEAN",
        # Media extras
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intro_videos JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS voice_note_key VARCHAR(500)",
        # NRI
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS visa_status VARCHAR(100)",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS willing_to_relocate BOOLEAN NOT NULL DEFAULT FALSE",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            try:
                await conn.execute(text(s))
            except Exception as e:
                logger.warning("schema_guard_failed", stmt=s, error=str(e))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", environment=settings.ENVIRONMENT, version=settings.APP_VERSION)
    try:
        await _ensure_verification_columns()
    except Exception as e:
        logger.warning("schema_guard_error", error=str(e))
    yield
    await close_redis()
    await engine.dispose()
    logger.info("shutdown")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
    lifespan=lifespan,
)

# ── Middleware (order matters — outermost first) ──────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(TenantMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://([a-zA-Z0-9-]+\.)?(m4mweb|match4marriage)\.vercel\.app|http://localhost:3000|https://match4marriage\.com|https://www\.match4marriage\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    """Ensure 500s carry CORS headers so the browser shows the real error, not 'CORS blocked'."""
    logger.error("unhandled_exception", path=str(request.url.path), error=str(exc), error_type=type(exc).__name__)
    origin = request.headers.get("origin", "")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}"},
        headers=headers,
    )

# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = settings.API_PREFIX

app.include_router(auth.router, prefix=PREFIX)
app.include_router(profile.router, prefix=PREFIX)
app.include_router(matches.router, prefix=PREFIX)
app.include_router(chat.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(notifications.router, prefix=PREFIX)
app.include_router(health.router, prefix=PREFIX)


# ── Health + meta ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health_simple():
    return {"status": "ok", "version": settings.APP_VERSION}


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }
