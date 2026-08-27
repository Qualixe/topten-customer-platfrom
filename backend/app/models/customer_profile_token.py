import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

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
    profile-completion page with no login system. Two ways a token comes to
    exist:

    - Admin-issued (`campaign_id` is null): POST
      /api/v1/customers/{id}/profile-token. Issuing a new one revokes any
      other still-active *admin-issued* token for that customer.
    - Campaign-issued (`campaign_id` set): generated the first time a
      campaign SMS is sent to this customer (see
      app.tasks.sms_campaigns.send_campaign_messages_async), one per
      (customer, campaign) pair, reused on retry rather than replaced.
      These never revoke each other, so a customer can hold one valid link
      per campaign at the same time — completing Campaign 1's form must not
      break their still-unused Campaign 2 link.
    """

    __tablename__ = "customer_profile_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False, default=generate_token
    )
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    campaign_id: Mapped[int | None] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=True, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_default_expiry
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
