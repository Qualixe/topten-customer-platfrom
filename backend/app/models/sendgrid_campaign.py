import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SendGridCampaignStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENDING = "SENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class SendGridCampaign(Base):
    """A local audit record of one SendGrid Marketing Campaign (a "Single
    Send") created through app.services.sendgrid_sync — deliberately its
    own table rather than reusing `Campaign`/`CampaignRecipient` (see those
    models' docstrings), since a SendGrid campaign sends through SendGrid's
    own engine against a synced List, not through this app's per-recipient
    SMS-style send loop. `sendgrid_campaign_id` is SendGrid's own id for
    the Single Send; `sendgrid_list_id` is the dedicated per-campaign List
    created to scope the send to exactly the customers selected at draft
    time (SendGrid has no lightweight ad-hoc "static segment" the way
    Mailchimp does, so a fresh List stands in for that)."""

    __tablename__ = "sendgrid_campaigns"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    sendgrid_campaign_id: Mapped[str] = mapped_column(String(50), nullable=False)
    sendgrid_list_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    html_body: Mapped[str] = mapped_column(Text, nullable=False)

    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=SendGridCampaignStatus.DRAFT.value,
        server_default=SendGridCampaignStatus.DRAFT.value,
        index=True,
    )
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
