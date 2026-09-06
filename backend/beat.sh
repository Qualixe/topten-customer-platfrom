#!/usr/bin/env bash
# Runs celery beat — the scheduler that fires every recurring task in
# app.core.celery_app's beat_schedule: the daily birthday-wish job AND the
# once-a-minute poller that actually sends "scheduled for later" campaigns
# once their time arrives (see app.tasks.sms_campaigns.
# dispatch_due_scheduled_campaigns — without this process running, that
# poller never fires and scheduled campaigns just sit there forever). This
# is a separate long-running process from both the API (start.sh) and the
# worker (worker.sh): beat only enqueues tasks on schedule, it never
# executes them itself, so a worker process must also be running for
# anything beat fires to actually happen. Deploy this as its own service
# (e.g. a third Railway service) pointed at this script — running it more
# than once would fire every scheduled task multiple times.

set -e

if [ -n "$DATABASE_URL" ]; then
  export DATABASE_URL=$(echo "$DATABASE_URL" \
    | sed 's|^postgres://|postgresql+asyncpg://|' \
    | sed 's|^postgresql://|postgresql+asyncpg://|')
fi

exec celery -A app.core.celery_app beat --loglevel=info
