from decimal import Decimal
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "TopTen Customer Platform API"
    APP_ENV: str = "development"

    # Async driver (asyncpg) for the application itself. Alembic migrations
    # run synchronously regardless (see migrations/env.py), which derives a
    # sync URL from this one rather than needing a second setting.
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/topten"
    REDIS_URL: str = "redis://localhost:6379/0"

    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None

    CORS_ORIGINS: str = "http://localhost:3000"

    API_V1_PREFIX: str = "/api/v1"

    SECRET_KEY: str = "change-me-in-production"

    # Auth: JWT signing reuses SECRET_KEY rather than a second secret — this
    # is a single-app deployment, not multiple services that need
    # independently rotatable keys. 7 days: a low-traffic internal admin
    # tool favors not forcing frequent re-login over short-lived tokens.
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Bootstrap admin, created by scripts/seed_auth.py (not on every
    # startup) — change these before running it against anything real.
    INITIAL_ADMIN_EMAIL: str = "admin@topten.com.bd"
    INITIAL_ADMIN_PASSWORD: str = "changeme123"
    INITIAL_ADMIN_NAME: str = "Admin"

    # POS customer import settings.
    UPLOAD_DIR: str = "var/uploads/imports"
    IMPORT_CHUNK_SIZE: int = 500
    IMPORT_DEFAULT_PHONE_REGION: str = "BD"

    # Site branding (logo upload) — a separate, publicly-servable directory
    # from UPLOAD_DIR, which holds POS import files that must never be
    # publicly downloadable.
    BRANDING_UPLOAD_DIR: str = "var/public/branding"

    # Gift catalog item photos — publicly servable like branding, but kept in
    # its own directory since it's unrelated content.
    GIFT_IMAGE_UPLOAD_DIR: str = "var/public/gift-images"

    # SMS campaigns: a placeholder rate for cost estimation only — no real
    # BulkSMS BD billing is wired up yet. Matches the frontend's mock rate
    # (see frontend/lib/mock/sms-account.ts) so estimates stay consistent
    # until a real provider rate is available.
    SMS_RATE_PER_SEGMENT_BDT: Decimal = Decimal("0.45")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def celery_broker_url(self) -> str:
        return self.CELERY_BROKER_URL or self.REDIS_URL

    @property
    def celery_result_backend(self) -> str:
        return self.CELERY_RESULT_BACKEND or self.REDIS_URL

    @property
    def sync_database_url(self) -> str:
        """A psycopg2 URL for Alembic, derived from the async DATABASE_URL."""
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
