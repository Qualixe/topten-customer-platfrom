from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BirthdaySettings(Base):
    """Singleton row (always id=1 in practice) controlling the automatic
    birthday SMS wish — see app.services.birthday_wishes for the daily job
    that reads this. `auto_assign_gift` is stored here for the admin's
    benefit but not yet acted on by anything (no gift-auto-queue feature
    exists yet); only `auto_send_message`/`message_template` actually
    drive the wish."""

    __tablename__ = "birthday_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    notify_days_before: Mapped[int] = mapped_column(Integer, nullable=False, server_default="3")
    auto_send_message: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    message_template: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        server_default="Happy Birthday, {{customer_name}}! Wishing you a wonderful year ahead. 🎉",
    )
    auto_assign_gift: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
