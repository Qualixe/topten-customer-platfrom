import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

DEFAULT_BUILDER_DATA = {"version": 1, "blocks": []}


class CampaignLandingPage(Base):
    """The page a customer opens from a campaign SMS. One per campaign
    (`campaign_id` is unique) — a campaign either has a landing page or it
    doesn't, there's no concept of multiple pages per campaign yet.

    `builder_data` is structured JSON built by the drag-and-drop builder
    (see app.views.campaign_landing_pages for the validated shape) — never
    generated HTML, never a serialized component tree. `slug` is the public,
    guessable-on-purpose identifier used in the public URL
    (/campaign/{slug}); the real security boundary is the customer's own
    CustomerProfileToken, not the slug.
    """

    __tablename__ = "campaign_landing_pages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    # JSONB on Postgres, plain JSON elsewhere (e.g. SQLite in a future unit
    # test) — same variant pattern as Campaign.audience_rule_params.
    builder_data: Mapped[dict] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=lambda: dict(DEFAULT_BUILDER_DATA),
        server_default='{"version": 1, "blocks": []}',
    )
    published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
