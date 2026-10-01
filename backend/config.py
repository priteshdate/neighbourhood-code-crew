"""Application settings, loaded from environment variables / backend/.env."""
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE), env_file_encoding="utf-8", extra="ignore"
    )

    APP_NAME: str = "Neighborhood Help Platform"

    # Supabase Postgres (use the *pooler* connection string, see .env.example)
    DATABASE_URL: str = (
        "postgresql+psycopg2://postgres:password@localhost:5432/postgres?sslmode=prefer"
    )

    @field_validator("DATABASE_URL")
    @classmethod
    def _use_psycopg2_driver(cls, v: str) -> str:
        """Supabase gives `postgresql://...` or `postgres://...`; SQLAlchemy needs a driver."""
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg2://" + v[len(prefix):]
        return v

    SECRET_KEY: str = "dev-only-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # SOS escalation
    ESCALATION_INTERVAL_SEC: int = 30
    ESCALATION_TICK_SEC: int = 10

    RATE_LIMIT_ENABLED: bool = True

    # localhost / 127.0.0.1 on any port, plus file:// pages (browsers send Origin: null)
    CORS_ORIGIN_REGEX: str = r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|null)$"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()