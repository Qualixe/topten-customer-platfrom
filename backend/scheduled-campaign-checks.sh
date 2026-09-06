#!/usr/bin/env bash
# Entrypoint for the Railway Cron Job service that runs
# scripts/run_scheduled_campaign_checks.py on a schedule — see that
# script's docstring. Same DATABASE_URL rewrite as start.sh/worker.sh.

set -e

if [ -n "$DATABASE_URL" ]; then
  export DATABASE_URL=$(echo "$DATABASE_URL" \
    | sed 's|^postgres://|postgresql+asyncpg://|' \
    | sed 's|^postgresql://|postgresql+asyncpg://|')
fi

exec python -m scripts.run_scheduled_campaign_checks
