#!/usr/bin/env bash
# Railway provides DATABASE_URL as postgresql:// or postgres://
# SQLAlchemy asyncpg driver requires postgresql+asyncpg://
# This script rewrites it before starting the app.

set -e

if [ -n "$DATABASE_URL" ]; then
  export DATABASE_URL=$(echo "$DATABASE_URL" \
    | sed 's|^postgres://|postgresql+asyncpg://|' \
    | sed 's|^postgresql://|postgresql+asyncpg://|')
fi

echo "Running migrations..."
alembic upgrade head

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
