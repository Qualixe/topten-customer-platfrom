from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BirthdaySettings(Base):
    """Singleton row (always id=1 in practice) controlling the automatic
    birthday wish — see app.services.birthday_wishes for the hourly job
    that reads this. `enabled` is the single master toggle; `channel`
    ("SMS", "EMAIL", or "BOTH") picks which wish(es) go out. `send_hour`
    (0-23, UTC) is compared against the current UTC hour by the Celery task
    wrapper (app.tasks.birthday_wishes), not by the service function
    itself, so the service stays callable at any hour for direct/manual
    invocations and tests. `last_run_at` is updated on every run that
    actually executes (enabled=True), regardless of whether any customer
    had a birthday that day. `auto_assign_gift` is stored here for the
    admin's benefit but not yet acted on by anything (no gift-auto-queue
    feature exists yet)."""

    __tablename__ = "birthday_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    notify_days_before: Mapped[int] = mapped_column(Integer, nullable=False, server_default="3")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    channel: Mapped[str] = mapped_column(String(10), nullable=False, server_default="SMS")
    send_hour: Mapped[int] = mapped_column(Integer, nullable=False, server_default="9")
    company_name: Mapped[str] = mapped_column(String(120), nullable=False, server_default="")
    message_template: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        server_default="Happy Birthday, {{customer_name}}! Wishing you a wonderful year ahead. 🎉",
    )
    email_subject: Mapped[str] = mapped_column(
        String(255), nullable=False, server_default="Happy Birthday, {{customer_name}}! 🎉"
    )
    email_message_template: Mapped[str] = mapped_column(
        String(2000),
        nullable=False,
        server_default="<p>Happy Birthday, {{customer_name}}!</p><p>Wishing you a wonderful year ahead. 🎉</p>",
    )
    auto_assign_gift: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
