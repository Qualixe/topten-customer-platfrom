from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "topten",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.imports", "app.tasks.sms_campaigns"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # A worker that dies mid-task redelivers it rather than losing it —
    # safe here because every DB write the import task makes is an upsert /
    # recompute, so redelivery can never double-count spending.
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)
