#!/usr/bin/env bash
# Redeploy seguro: rebuild + recreação forçada
set -euo pipefail
SERVICE="${1:-gateway}"
cd "$(dirname "$0")"

echo "==> rebuilding $SERVICE"
docker compose build "$SERVICE"

echo "==> recreating $SERVICE"
docker compose up -d --force-recreate "$SERVICE"

echo "==> waiting for startup"
sleep 10

echo "==> status"
docker compose ps "$SERVICE"

echo "==> logs (últimas 10)"
docker compose logs --tail 10 "$SERVICE"
