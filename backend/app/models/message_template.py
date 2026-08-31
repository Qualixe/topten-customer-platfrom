import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MessageTemplateChannel(str, enum.Enum):
    SMS = "SMS"
    EMAIL = "EMAIL"


class MessageTemplateCategory(str, enum.Enum):
    PROMOTIONAL = "PROMOTIONAL"
    BIRTHDAY = "BIRTHDAY"
    VIP = "VIP"
    PROFILE_COMPLETION = "PROFILE_COMPLETION"
    GENERAL = "GENERAL"


class MessageTemplate(Base):
    """A reusable, named message body an admin can start a campaign from
    (see app.models.campaign) instead of composing from scratch every time.
    Purely a starting point — picking one just pre-fills the campaign
    wizard's subject/body fields; editing or deleting a template afterward
    never touches campaigns that already copied its text."""

    __tablename__ = "message_templates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=False, default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    category: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=MessageTemplateCategory.GENERAL.value,
        server_default=MessageTemplateCategory.GENERAL.value,
        index=True,
    )

    # Only meaningful for EMAIL — SMS has no subject line. Enforced at the
    # Pydantic layer (see app.views.message_templates), not the DB.
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
