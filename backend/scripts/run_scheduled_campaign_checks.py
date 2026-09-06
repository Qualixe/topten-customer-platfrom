"""One-shot runner for the periodic campaign catch-up checks — intended for
a Railway Cron Job service (run every few minutes) rather than a
long-running `celery beat` process, since these two checks are cheap and
don't need a persistent scheduler.

Runs the exact same logic as the Celery beat schedule entries
"dispatch-due-scheduled-campaigns" / "retry-stuck-unresolved-campaigns"
(see app.core.celery_app) — this script exists so that logic can run
without `celery beat` actually deployed as its own always-on process. If
`celery beat` is ever deployed instead, this script (and the cron job
calling it) should be retired to avoid running the same checks twice.

Run: `python -m scripts.run_scheduled_campaign_checks` (from `backend/`).
"""

import asyncio

from app.database import engine
from app.tasks.sms_campaigns import (
    dispatch_due_scheduled_campaigns_async,
    retry_stuck_unresolved_campaigns_async,
)


async def main() -> None:
    try:
        dispatched = await dispatch_due_scheduled_campaigns_async()
        retried = await retry_stuck_unresolved_campaigns_async()
        print(f"dispatched_due={dispatched} retried_unresolved={retried}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
