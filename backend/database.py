"""SQLAlchemy engine, session factory and declarative base (Supabase Postgres)."""
from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> Engine:
    """Build an engine. Postgres gets a small pool (Supabase poolers cap connections);
    SQLite (used by unit tests) gets one shared connection so in-memory DBs persist."""
    if url.startswith("sqlite"):
        kwargs: dict[str, Any] = {"connect_args": {"check_same_thread": False}}
        if ":memory:" in url or url.rstrip("/") == "sqlite:":
            kwargs["poolclass"] = StaticPool
        return create_engine(url, **kwargs)
    return create_engine(
        url,
        pool_pre_ping=True,   # survive connections dropped by the pooler
        pool_recycle=1800,
        pool_size=5,
        max_overflow=5,
    )


engine: Engine = make_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: one session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def enable_rls() -> None:
    """Supabase exposes every table in the `public` schema through its auto-generated
    REST API. Turning on Row Level Security with NO policies blocks that API (so the
    public anon key can never read password hashes), while this backend keeps full
    access because it connects as the `postgres` role, which bypasses RLS. Idempotent."""
    if engine.dialect.name != "postgresql":
        return
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            conn.execute(text(f'ALTER TABLE "{table.name}" ENABLE ROW LEVEL SECURITY'))


def init_db() -> None:
    """Create all tables (and lock them down with RLS on Postgres)."""
    from app import models  # noqa: F401  (registers tables on Base.metadata)

    Base.metadata.create_all(bind=engine)
    enable_rls()