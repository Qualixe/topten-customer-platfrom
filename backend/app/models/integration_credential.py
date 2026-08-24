from datetime import datetime

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class IntegrationCredential(Base):
    """
    One row per external integration (e.g. "sms_gateway", "pathao"), storing
    that provider's API credentials as a flat JSON object. A single generic
    table avoids a new migration for every future provider; which fields are
    secret vs. plain is defined per-provider in each module's schemas, not
    stored here.

    Note: stored in plaintext — there is no authentication on any endpoint in
    this app yet, so encrypting this column would add complexity without a
    matching access-control boundary to actually protect. Add both together
    before using real production credentials here.
    """

    __tablename__ = "integration_credentials"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
