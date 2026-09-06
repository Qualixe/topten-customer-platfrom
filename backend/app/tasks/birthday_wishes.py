"""Daily Celery-beat task that sends the automatic birthday SMS wish — see
app.services.birthday_wishes for the actual send logic (this module is
just the async-to-sync Celery wrapper, same shape as app.tasks.sms_campaigns).
"""

import asyncio

from app.core.celery_app import celery_app
from app.database import SessionLocal, engine
from app.services.birthday_wishes import send_todays_birthday_wishes


async def _run_and_dispose() -> None:
    # See app.tasks.imports for why the engine must be disposed at the end
    # of every task: each Celery task invocation gets its own fresh event
    # loop via asyncio.run(), but the async engine's connection pool is
    # created once at import time and would otherwise stay bound to
    # whichever loop first used it.
    try:
        async with SessionLocal() as session:
            await send_todays_birthday_wishes(session)
    finally:
        await engine.dispose()


@celery_app.task(name="birthday_wishes.send_daily_birthday_wishes")
def send_daily_birthday_wishes() -> None:
    asyncio.run(_run_and_dispose())
