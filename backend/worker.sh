#!/usr/bin/env bash
# Same DATABASE_URL rewrite needed for the Celery worker.

set -e

if [ -n "$DATABASE_URL" ]; then
  export DATABASE_URL=$(echo "$DATABASE_URL" \
    | sed 's|^postgres://|postgresql+asyncpg://|' \
    | sed 's|^postgresql://|postgresql+asyncpg://|')
fi

exec celery -A app.core.celery_app worker --loglevel=info --concurrency=2
