import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, String, func
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
    `CampaignLandingPage`. An admin builds a form here once, then either:

    - attaches it to a campaign (see `attach_form_to_campaign` in
      app.services.forms), which copies its fields into that campaign's own
      `CampaignLandingPage` — a tokenized link for one already-known
      customer, reusing the existing send/token/verification pipeline; or
    - publishes it directly here (`slug`/`published`) as an open public form
      at /form/{slug} that anyone can fill in, no token, no prior customer
      record — a submission creates a new Customer (matched/deduped by
      phone) rather than updating one identified by a token. See
      app.services.forms.submit_generic_form.

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

    # The open-form public URL — null until the admin publishes it directly
    # (as opposed to attaching it to a campaign, which never touches these).
    slug: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    @property
    def status(self) -> str:
        """DRAFT/PUBLISHED shown in the Forms list — derived from
        `published`, not stored separately, so it's never possible for the
        two to drift out of sync (the exact bug this replaced: a form could
        previously show "Draft" in the list while already being live and
        publicly reachable, or vice versa)."""
        return FormStatus.PUBLISHED.value if self.published else FormStatus.DRAFT.value

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
