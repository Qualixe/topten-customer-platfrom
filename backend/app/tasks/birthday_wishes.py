"""Per-minute Celery-beat task that sends the automatic birthday wish once
it's the configured send time — see app.services.birthday_wishes for the
actual send logic (this module is just the async-to-sync Celery wrapper,
same shape as app.tasks.sms_campaigns).

The time gate (comparing `BirthdaySettings.send_hour`/`send_minute` to the
current UTC time) lives here rather than inside the service function, so
that `send_todays_birthday_wishes` stays callable at any wall-clock time
for direct/manual invocations and tests — beat itself fires every minute
(see app.core.celery_app), and all but one firing a day is expected to be
a no-op.
"""

import asyncio
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.celery_app import celery_app
from app.database import SessionLocal, engine
from app.services.birthday_wishes import get_or_create_birthday_settings, send_todays_birthday_wishes


async def run_birthday_send_check(
    session_factory: async_sessionmaker[AsyncSession] = SessionLocal,
) -> None:
    """`session_factory` defaults to the production session maker; tests
    pass `TestSessionLocal` so this can be exercised against the test DB
    without touching Celery."""
    async with session_factory() as session:
        settings_row = await get_or_create_birthday_settings(session)
        now = datetime.now(UTC)
        if not settings_row.enabled or (settings_row.send_hour, settings_row.send_minute) != (
            now.hour,
            now.minute,
        ):
            return
        await send_todays_birthday_wishes(session)


async def _run_and_dispose() -> None:
    # See app.tasks.imports for why the engine must be disposed at the end
    # of every task: each Celery task invocation gets its own fresh event
    # loop via asyncio.run(), but the async engine's connection pool is
    # created once at import time and would otherwise stay bound to
    # whichever loop first used it.
    try:
        await run_birthday_send_check()
    finally:
        await engine.dispose()


@celery_app.task(name="birthday_wishes.send_daily_birthday_wishes")
def send_daily_birthday_wishes() -> None:
    asyncio.run(_run_and_dispose())
