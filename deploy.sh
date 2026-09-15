#!/usr/bin/env bash
# deploy.sh — Pull latest code and redeploy all services with zero-downtime.
# Run from the project root on your VPS: bash deploy.sh

set -euo pipefail

ENV_FILE=".env.prod"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.prod.example and fill in values."
  exit 1
fi

STASHED=0
if [ -n "$(git status --porcelain)" ]; then
  echo "▶ Stashing local changes (e.g. certbot-managed nginx configs) before pull..."
  git stash push -u -m "deploy.sh-autostash-$(date +%Y%m%d%H%M%S)"
  STASHED=1
fi

echo "▶ Pulling latest code..."
if ! git pull origin master; then
  echo "ERROR: git pull failed."
  if [ "$STASHED" -eq 1 ]; then
    echo "▶ Restoring stashed local changes before exiting..."
    git stash pop || echo "⚠ WARNING: git stash pop also failed. Check 'git stash list'."
  fi
  exit 1
fi

if [ "$STASHED" -eq 1 ]; then
  echo "▶ Restoring stashed local changes..."
  if ! git stash pop; then
    echo "⚠ WARNING: git stash pop hit a conflict. Resolve it manually, then re-run deploy.sh. (See 'git stash list'.)"
    exit 1
  fi
fi

echo "▶ Building images..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" build --pull

echo "▶ Starting services (migrations run automatically inside backend)..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --remove-orphans

echo "▶ Reloading nginx (picks up new container IPs for backend/frontend)..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec nginx nginx -s reload

echo "▶ Cleaning up dangling images..."
docker image prune -f

echo "✓ Deployment complete."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" ps
