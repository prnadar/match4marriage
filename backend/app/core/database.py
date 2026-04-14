"""
SQLAlchemy async engine + session factory.
Uses asyncpg driver for maximum throughput.
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

# Convert sync postgres:// URL to async asyncpg driver.
# Neon URLs include `?sslmode=require&channel_binding=require`; asyncpg doesn't
# parse those libpq params, so strip the query string and pass ssl via connect_args.
from urllib.parse import urlsplit, urlunsplit

_raw = settings.DATABASE_URL
_raw = _raw.replace("postgresql://", "postgresql+asyncpg://").replace(
    "postgres://", "postgresql+asyncpg://"
)

_is_sqlite = _raw.startswith("sqlite")
_connect_args: dict = {}
if not _is_sqlite:
    parts = urlsplit(_raw)
    if parts.query:
        _raw = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
    # Neon requires TLS
    _connect_args["ssl"] = "require"

_db_url = _raw
_engine_kwargs: dict = {"pool_pre_ping": True, "echo": settings.DEBUG}
if not _is_sqlite:
    _engine_kwargs.update(
        {
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
            "connect_args": _connect_args,
        }
    )

engine = create_async_engine(_db_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
