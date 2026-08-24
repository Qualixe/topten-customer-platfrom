import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class CampaignRecipientStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


class CampaignRecipient(Base):
    """
    One row per customer resolved into a campaign's audience snapshot, at
    the moment it was resolved (see
    app.modules.sms_campaigns.tasks.resolve_campaign_audience). `phone` is
    copied from the customer at that moment rather than joined live, so the
    recipient list is a true point-in-time snapshot even if the customer's
    phone number is edited afterward.

    The (campaign_id, customer_id) unique constraint is what makes snapshot
    creation idempotent: it's built via a single `INSERT ... SELECT ... ON
    CONFLICT DO NOTHING`, so a retried/redelivered Celery task never creates
    duplicates and never double-counts `total_recipients`.
    """

    __tablename__ = "campaign_recipients"
    __table_args__ = (
        UniqueConstraint(
            "campaign_id", "customer_id", name="uq_campaign_recipients_campaign_customer"
        ),
        # Backs the correlated EXISTS/NOT EXISTS subqueries used by the
        # NEVER_RECEIVED_TYPE / RECEIVED_TYPE_BEFORE_DATE audience rules,
        # which look up "does this customer_id have any recipient row for a
        # campaign of type X" — a customer_id-first index lets Postgres
        # probe that per candidate customer instead of scanning every
        # recipient row.
        Index("ix_campaign_recipients_customer_id", "customer_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    phone: Mapped[str] = mapped_column(String(32), nullable=False)

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=CampaignRecipientStatus.PENDING.value,
        server_default=CampaignRecipientStatus.PENDING.value,
        index=True,
    )
    provider_message_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
