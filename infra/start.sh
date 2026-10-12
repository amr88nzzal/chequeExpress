#!/usr/bin/env bash
# Build and start the stack on the server, then check health.
# Usage (from anywhere):  bash infra/start.sh        # uses port 3600 by default
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  PASS="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
  sed -i "s/^POSTGRES_OWNER_PASSWORD=.*/POSTGRES_OWNER_PASSWORD=${PASS}/" .env
  echo "created infra/.env with a random database password"
fi

docker compose --env-file .env up -d --build --remove-orphans

PORT="$(grep -E '^GATEWAY_PORT=' .env | cut -d= -f2)"; PORT="${PORT:-3600}"
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/health/ready" >/dev/null 2>&1; then
    echo "OK: http://127.0.0.1:${PORT}/health/live"
    curl -fsS "http://127.0.0.1:${PORT}/health/live"; echo
    docker compose --env-file .env ps
    exit 0
  fi
  sleep 3
done
echo "FAILED: not ready after 2 minutes"
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=60 api gateway
exit 1
