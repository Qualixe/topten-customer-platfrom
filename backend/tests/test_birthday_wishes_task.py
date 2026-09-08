"""Exercises the Celery task wrapper's hour/minute gate directly (never
touches Celery/a real broker) — see app.tasks.birthday_wishes. The
service-level send behavior itself is covered by test_birthday_wishes.py."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.birthday_wishes import update_birthday_settings
from app.tasks.birthday_wishes import run_birthday_send_check
from tests.conftest import TestSessionLocal


def _frozen_datetime(fixed: datetime) -> MagicMock:
    """A drop-in replacement for the `datetime` class that only supports
    `.now(UTC)` — everything this task module calls on it."""
    mock_datetime = MagicMock(wraps=datetime)
    mock_datetime.now.return_value = fixed
    return mock_datetime


async def test_noop_when_hour_does_not_match(db_session: AsyncSession) -> None:
    await update_birthday_settings(
        db_session,
        notify_days_before=3,
        enabled=True,
        channel="SMS",
        send_hour=9,
        send_minute=0,
        company_name="",
        message_template="Happy Birthday, {{customer_name}}!",
        email_subject="Happy Birthday, {{customer_name}}!",
        email_message_template="<p>Happy Birthday, {{customer_name}}!</p>",
        auto_assign_gift=False,
    )

    with (
        patch(
            "app.tasks.birthday_wishes.datetime",
            new=_frozen_datetime(datetime(2026, 6, 15, 8, 0, tzinfo=UTC)),
        ),
        patch(
            "app.tasks.birthday_wishes.send_todays_birthday_wishes", new=AsyncMock()
        ) as mock_send,
    ):
        await run_birthday_send_check(session_factory=TestSessionLocal)

    mock_send.assert_not_called()


async def test_runs_when_hour_matches(db_session: AsyncSession) -> None:
    await update_birthday_settings(
        db_session,
        notify_days_before=3,
        enabled=True,
        channel="SMS",
        send_hour=9,
        send_minute=0,
        company_name="",
        message_template="Happy Birthday, {{customer_name}}!",
        email_subject="Happy Birthday, {{customer_name}}!",
        email_message_template="<p>Happy Birthday, {{customer_name}}!</p>",
        auto_assign_gift=False,
    )

    with (
        patch(
            "app.tasks.birthday_wishes.datetime",
            new=_frozen_datetime(datetime(2026, 6, 15, 9, 0, tzinfo=UTC)),
        ),
        patch(
            "app.tasks.birthday_wishes.send_todays_birthday_wishes", new=AsyncMock()
        ) as mock_send,
    ):
        await run_birthday_send_check(session_factory=TestSessionLocal)

    mock_send.assert_called_once()


async def test_noop_when_minute_does_not_match(db_session: AsyncSession) -> None:
    await update_birthday_settings(
        db_session,
        notify_days_before=3,
        enabled=True,
        channel="SMS",
        send_hour=9,
        send_minute=30,
        company_name="",
        message_template="Happy Birthday, {{customer_name}}!",
        email_subject="Happy Birthday, {{customer_name}}!",
        email_message_template="<p>Happy Birthday, {{customer_name}}!</p>",
        auto_assign_gift=False,
    )

    with (
        patch(
            "app.tasks.birthday_wishes.datetime",
            # Right hour, wrong minute — should still no-op.
            new=_frozen_datetime(datetime(2026, 6, 15, 9, 0, tzinfo=UTC)),
        ),
        patch(
            "app.tasks.birthday_wishes.send_todays_birthday_wishes", new=AsyncMock()
        ) as mock_send,
    ):
        await run_birthday_send_check(session_factory=TestSessionLocal)

    mock_send.assert_not_called()


async def test_runs_when_hour_and_minute_match(db_session: AsyncSession) -> None:
    await update_birthday_settings(
        db_session,
        notify_days_before=3,
        enabled=True,
        channel="SMS",
        send_hour=9,
        send_minute=30,
        company_name="",
        message_template="Happy Birthday, {{customer_name}}!",
        email_subject="Happy Birthday, {{customer_name}}!",
        email_message_template="<p>Happy Birthday, {{customer_name}}!</p>",
        auto_assign_gift=False,
    )

    with (
        patch(
            "app.tasks.birthday_wishes.datetime",
            new=_frozen_datetime(datetime(2026, 6, 15, 9, 30, tzinfo=UTC)),
        ),
        patch(
            "app.tasks.birthday_wishes.send_todays_birthday_wishes", new=AsyncMock()
        ) as mock_send,
    ):
        await run_birthday_send_check(session_factory=TestSessionLocal)

    mock_send.assert_called_once()


async def test_noop_when_disabled_even_at_matching_hour(db_session: AsyncSession) -> None:
    with (
        patch(
            "app.tasks.birthday_wishes.datetime",
            new=_frozen_datetime(datetime(2026, 6, 15, 9, 0, tzinfo=UTC)),
        ),
        patch(
            "app.tasks.birthday_wishes.send_todays_birthday_wishes", new=AsyncMock()
        ) as mock_send,
    ):
        await run_birthday_send_check(session_factory=TestSessionLocal)

    mock_send.assert_not_called()
