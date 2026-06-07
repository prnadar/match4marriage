"""
Multi-tenancy middleware and context.

Each white-label client (marriage bureau, regional brand) is a Tenant.
tenant_id is injected into every request context and stamped on all DB rows.
Lookup order: X-Tenant-ID header → subdomain → default tenant.
"""
import contextvars
import re
from uuid import UUID

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()

# Cheap structural validation for incoming tenant slugs. The header is
# unauthenticated input, so we shape-check here BEFORE it goes anywhere
# near a DB query. Any slug that doesn't match falls through to the
# default tenant. Real tenant existence is enforced at DB-resolve time
# (profile._resolve_tenant_uuid no longer auto-provisions on miss).
_VALID_SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")


def _sanitize_slug(raw: str | None) -> str | None:
    if not raw:
        return None
    slug = raw.strip().lower()
    return slug if _VALID_SLUG.match(slug) else None

# Request-scoped tenant context
_current_tenant_id: contextvars.ContextVar[UUID | None] = contextvars.ContextVar(
    "current_tenant_id", default=None
)
_current_tenant_slug: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_tenant_slug", default=settings.DEFAULT_TENANT_SLUG
)


def get_current_tenant_id() -> UUID | None:
    return _current_tenant_id.get()


def get_current_tenant_slug() -> str:
    return _current_tenant_slug.get()


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Resolves tenant from request and injects into context vars.
    Health/docs endpoints bypass tenant resolution.
    """

    BYPASS_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.BYPASS_PATHS:
            return await call_next(request)

        tenant_slug = await self._resolve_tenant_slug(request)
        if not tenant_slug:
            return JSONResponse(
                {"detail": "Tenant not found", "code": "TENANT_NOT_FOUND"},
                status_code=404,
            )

        token_slug = _current_tenant_slug.set(tenant_slug)
        try:
            # Tenant UUID is resolved lazily by DB queries needing it
            response = await call_next(request)
            return response
        finally:
            _current_tenant_slug.reset(token_slug)

    async def _resolve_tenant_slug(self, request: Request) -> str | None:
        # 1. Explicit header (for API clients / mobile apps). Shape-validate.
        header_slug = _sanitize_slug(request.headers.get(settings.TENANT_HEADER))
        if header_slug:
            return header_slug

        # 2. Subdomain: match4marriage.com → default, bureau-xyz.match4marriage.com → bureau-xyz
        host = request.headers.get("host", "").split(":")[0]
        parts = host.split(".")
        if len(parts) >= 3:
            sub = _sanitize_slug(parts[0])
            if sub and sub not in ("www", "api"):
                return sub

        # 3. Fall back to default tenant
        return settings.DEFAULT_TENANT_SLUG
