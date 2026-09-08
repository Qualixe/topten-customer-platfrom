from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "topten",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.imports", "app.tasks.sms_campaigns", "app.tasks.birthday_wishes"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # This app's whole audience is Bangladesh-based (see the SMS gateway,
    # phone normalization, etc. elsewhere). None of the beat schedules
    # below currently use `crontab(...)` (all are fixed-interval floats,
    # timezone-independent), but `timezone` stays set to Dhaka for any
    # `crontab(...)` schedule added later — it would otherwise default to
    # UTC and silently fire at the wrong local hour.
    timezone="Asia/Dhaka",
    enable_utc=True,
    # A worker that dies mid-task redelivers it rather than losing it —
    # safe here because every DB write the import task makes is an upsert /
    # recompute, so redelivery can never double-count spending.
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Requires a `celery beat` process running alongside the worker (see
    # beat.sh) — the worker alone never fires anything on its own schedule.
    beat_schedule={
        # Fires every minute — app.tasks.birthday_wishes itself checks
        # BirthdaySettings.send_hour/send_minute against the current UTC
        # time and no-ops unless both match, so admins can pick any UTC
        # send time (minute precision) without a beat-schedule change.
        "send-daily-birthday-wishes": {
            "task": "birthday_wishes.send_daily_birthday_wishes",
            "schedule": 60.0,
        },
        # Catches campaigns scheduled for a future time that has since
        # arrived — see app.tasks.sms_campaigns' module docstring. Every
        # minute keeps "scheduled for later" reasonably precise without
        # hammering the database.
        "dispatch-due-scheduled-campaigns": {
            "task": "sms_campaigns.dispatch_due_scheduled_campaigns",
            "schedule": 60.0,
        },
        # Safety net for a lost initial resolve — see
        # app.tasks.sms_campaigns.retry_stuck_unresolved_campaigns.
        "retry-stuck-unresolved-campaigns": {
            "task": "sms_campaigns.retry_stuck_unresolved_campaigns",
            "schedule": 60.0,
        },
    },
)
