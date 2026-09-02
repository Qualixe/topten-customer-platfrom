import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CampaignRecipientStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    BOUNCED = "BOUNCED"
    FAILED = "FAILED"


class VerificationStatus(str, enum.Enum):
    """Whether this customer completed the campaign's profile form —
    completely independent of `CampaignRecipientStatus` above. An SMS being
    DELIVERED says nothing about whether the customer ever opened the link
    and submitted the form; only a successful public-profile submission
    (see app.controllers.public_profile) sets this to VERIFIED."""

    PENDING = "PENDING"
    VERIFIED = "VERIFIED"


class CampaignRecipient(Base):
    """
    One row per customer resolved into a campaign's audience snapshot, at
    the moment it was resolved (see
    app.tasks.sms_campaigns.resolve_campaign_audience). `phone` and `name`
    are copied from the customer at that moment rather than joined live, so
    the recipient list is a true point-in-time snapshot even if the
    customer's phone number or name is edited afterward — `name` also
    feeds `{{customer_name}}` personalization at send time (see
    app.services.sms_campaigns_sms_utils.render_message), so a name change
    mid-campaign can't retroactively alter an already-resolved message.

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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Populated at resolve time same as phone/name, regardless of the
    # campaign's channel — cheap to always copy, and means an EMAIL
    # campaign's audience resolution (see app.tasks.sms_campaigns) can
    # filter on it directly rather than joining back to Customer.
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Also copied at resolve time — feeds the `{{birthday}}` personalization
    # token (see app.services.sms_campaigns_personalization) with the same
    # point-in-time-snapshot guarantee as name/phone/email.
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=CampaignRecipientStatus.PENDING.value,
        server_default=CampaignRecipientStatus.PENDING.value,
        index=True,
    )
    # Mandrill's message id for this send, captured from the API response
    # at send time — this is the correlation key the delivery webhook (see
    # app.controllers.email_webhooks) uses to match an incoming event back
    # to this row. Unique because only a successful send ever sets it, and
    # a recipient leaves the PENDING pool once sent, so it can never
    # legitimately collide.
    provider_message_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True, index=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bounced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Set when this recipient successfully submits the campaign's public
    # profile form (see app.controllers.public_profile). Separate from
    # `status` above on purpose — see VerificationStatus's docstring.
    verification_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=VerificationStatus.PENDING.value,
        server_default=VerificationStatus.PENDING.value,
        index=True,
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
