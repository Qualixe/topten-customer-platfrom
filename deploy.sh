#!/usr/bin/env bash
# deploy.sh — Pull latest code and redeploy all services with zero-downtime.
# Run from the project root on your VPS: bash deploy.sh

set -euo pipefail

ENV_FILE=".env.prod"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.prod.example and fill in values."
  exit 1
fi

echo "▶ Pulling latest code..."
git pull origin main

echo "▶ Building images..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" build --pull

echo "▶ Starting services (migrations run automatically inside backend)..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --remove-orphans

echo "▶ Cleaning up dangling images..."
docker image prune -f

echo "✓ Deployment complete."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" ps
