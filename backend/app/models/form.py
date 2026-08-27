import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

DEFAULT_BUILDER_DATA = {"version": 1, "fields": []}


class FormStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class Form(Base):
    """A reusable, standalone form definition built in the Form Builder
    (/dashboard/forms) — independent of any single campaign, unlike
    `CampaignLandingPage`. An admin builds a form here once, then attaches
    it to one or more campaigns (see `attach_form_to_campaign` in
    app.services.forms) to actually send and collect it — attaching copies
    the form's fields into that campaign's own `CampaignLandingPage`, so
    the existing, already-verified send/token/verification pipeline is
    reused unchanged rather than duplicated.

    `builder_data` is structured JSON (see app.views.forms for the
    validated shape) — never generated HTML, never a serialized component
    tree.
    """

    __tablename__ = "forms"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=FormStatus.DRAFT.value,
        server_default=FormStatus.DRAFT.value,
    )

    # JSONB on Postgres, plain JSON elsewhere (e.g. SQLite in unit tests) —
    # same variant pattern as CampaignLandingPage.builder_data.
    builder_data: Mapped[dict] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=lambda: dict(DEFAULT_BUILDER_DATA),
        server_default='{"version": 1, "fields": []}',
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
