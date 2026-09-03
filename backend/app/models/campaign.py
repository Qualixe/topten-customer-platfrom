import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CampaignStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class CampaignChannel(str, enum.Enum):
    SMS = "SMS"
    EMAIL = "EMAIL"


class CampaignType(str, enum.Enum):
    """What kind of campaign this is — independent of who it targets (that's
    `audience_rule_type`). Used by the NEVER_RECEIVED_TYPE /
    RECEIVED_TYPE_BEFORE_DATE audience rules to look back at campaign
    history by category."""

    PROFILE_COMPLETION = "PROFILE_COMPLETION"
    PROMOTIONAL = "PROMOTIONAL"
    BIRTHDAY = "BIRTHDAY"
    VIP = "VIP"
    VVIP = "VVIP"
    GENERAL = "GENERAL"


class AudienceRuleType(str, enum.Enum):
    # GENERAL/VIP/VVIP are kept only so campaigns created before CUSTOMER_TYPE
    # existed keep resolving correctly (a stored rule is never rewritten —
    # see resolve_since_campaign's docstring for the same reasoning). Every
    # new campaign — including ones targeting General, VIP, or VVIP — uses
    # CUSTOMER_TYPE instead, since customer types are now admin-manageable
    # rather than a fixed three.
    GENERAL = "GENERAL"
    VIP = "VIP"
    VVIP = "VVIP"
    CUSTOMER_TYPE = "CUSTOMER_TYPE"
    NEW_SINCE_DATE = "NEW_SINCE_DATE"
    MISSING_DOB = "MISSING_DOB"
    MISSING_ADDRESS = "MISSING_ADDRESS"
    MISSING_DOB_AND_ADDRESS = "MISSING_DOB_AND_ADDRESS"
    NEVER_RECEIVED_TYPE = "NEVER_RECEIVED_TYPE"
    RECEIVED_TYPE_BEFORE_DATE = "RECEIVED_TYPE_BEFORE_DATE"
    SPECIFIC_CUSTOMERS = "SPECIFIC_CUSTOMERS"
    # Never completed a profile form for any campaign, ever (includes
    # customers who were never even targeted by one).
    NEVER_VERIFIED = "NEVER_VERIFIED"
    # Targeted by at least one campaign but hasn't completed a profile form
    # for any of them — narrower than NEVER_VERIFIED (excludes customers
    # who were never targeted at all).
    TARGETED_NOT_VERIFIED = "TARGETED_NOT_VERIFIED"


class Campaign(Base):
    """
    A campaign definition. Audience membership is expressed as a rule
    (`audience_rule_type` + `audience_rule_params`) rather than a fixed list
    of customer ids — resolving that rule into an actual recipient list only
    happens once, right after creation (see
    app.tasks.sms_campaigns.resolve_campaign_audience), which writes
    a `CampaignRecipient` row per matched customer. That snapshot is what
    everything downstream (recipient count, sending, stats) reads from — the
    rule itself is never re-evaluated, so customers imported later never
    retroactively join a campaign that already resolved its audience.

    `total_recipients`, `sms_segments`, and `estimated_cost` are
    server-computed; `recipients_resolved_at` is null until the background
    snapshot step has finished (poll `GET /sms/campaigns/{id}` until it's
    set before trusting `total_recipients`).
    """

    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    campaign_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    # SMS (the original, default channel) or EMAIL. Everything below that's
    # channel-specific — sender_id/sms_segments/estimated_cost for SMS,
    # subject for EMAIL — is nullable/zeroed for the channel it doesn't
    # apply to, enforced at the Pydantic layer (see app.views.sms_campaigns)
    # rather than the DB.
    channel: Mapped[str] = mapped_column(
        String(10), nullable=False, default=CampaignChannel.SMS.value,
        server_default=CampaignChannel.SMS.value, index=True,
    )

    audience_rule_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # JSONB on Postgres, plain JSON elsewhere (e.g. SQLite in a future unit
    # test) — see app.services.sms_campaigns_audience for the shape per rule.
    audience_rule_params: Mapped[dict] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=False, default=dict, server_default="{}"
    )

    message: Mapped[str] = mapped_column(Text, nullable=False)
    # Required for SMS, unused for EMAIL (which uses `subject` below instead).
    sender_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Required for EMAIL, unused for SMS (which has no subject line).
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)

    total_recipients: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    sms_segments: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    estimated_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default="0"
    )

    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=CampaignStatus.DRAFT.value,
        server_default=CampaignStatus.DRAFT.value,
        index=True,
    )

    # Set once the recipient snapshot has been created (see tasks.py). Null
    # means the audience is still resolving in the background — total_recipients
    # and estimated_cost are not yet trustworthy.
    recipients_resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
