#!/usr/bin/env bash
# Deploy over SSH:  infra/deploy.sh <ssh-target> <image-tag> [remote-dir]
# Steps: sync compose files -> pull images -> (migrations step, added in C0-3) -> restart -> wait for /health/ready.
set -euo pipefail

TARGET="${1:?usage: deploy.sh <user@host> <image-tag> [remote-dir]}"
TAG="${2:?image tag required}"
DIR="${3:-/opt/cheques}"
HERE="$(cd "$(dirname "$0")" && pwd)"

ssh "$TARGET" "mkdir -p '$DIR'"
rsync -az --delete --exclude '.env' "$HERE/docker-compose.yml" "$HERE/gateway" "$TARGET:$DIR/"

ssh "$TARGET" bash -s -- "$DIR" "$TAG" <<'REMOTE'
set -euo pipefail
DIR="$1"; TAG="$2"
cd "$DIR"
test -f .env || { echo ".env missing on server (copy .env.example)"; exit 1; }
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" .env
docker compose --env-file .env pull api
# Database migrations run here as a separate step once they exist (C0-3).
docker compose --env-file .env up -d --remove-orphans
PORT="$(grep -E '^PORT=' .env | cut -d= -f2 || true)"; PORT="${PORT:-3650}"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/health/ready" >/dev/null; then
    echo "ready"; curl -fsS "http://127.0.0.1:${PORT}/health/live"; echo; exit 0
  fi
  sleep 2
done
echo "not ready after 60s"; docker compose --env-file .env logs --tail=50 api; exit 1
REMOTE
