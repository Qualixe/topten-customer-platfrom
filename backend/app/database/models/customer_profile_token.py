import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base

DEFAULT_TOKEN_TTL_DAYS = 7


def generate_token() -> str:
    """A cryptographically random, opaque credential — not derived from or
    decodable back to `Customer.public_id`. The admin-visible customer id
    and this "magic link" secret must never be the same value."""
    return secrets.token_urlsafe(32)


def _default_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(days=DEFAULT_TOKEN_TTL_DAYS)


class CustomerProfileToken(Base):
    """A single-use-at-a-time secure link letting a customer reach their own
    profile-completion page with no login system. Issued by an admin action
    (see POST /api/v1/customers/{id}/profile-token); issuing a new one
    revokes any still-active token for that customer."""

    __tablename__ = "customer_profile_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False, default=generate_token
    )
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_default_expiry
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
