#!/usr/bin/env bash
# Build and start the stack on the server, then check health.  Usage: bash infra/start.sh
set -euo pipefail
cd "$(dirname "$0")"

rand() { head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
has_key() { grep -q "^$1=" .env; }
get() { grep -E "^$1=" .env | head -n1 | cut -d= -f2-; }
put() { # put KEY VALUE: replace or append
  if has_key "$1"; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
default() { has_key "$1" || put "$1" "$2"; }
secret() { # secret KEY LENGTH: generate when missing or still a "change-me" placeholder
  if ! has_key "$1" || [[ "$(get "$1")" == change-me* ]]; then put "$1" "$(rand "$2")"; echo "generated $1"; fi
}

[ -f .env ] || { cp .env.example .env; echo "created infra/.env"; }

# upgrade an .env written by an older version of this script
if has_key GATEWAY_PORT; then sed -i '/^GATEWAY_PORT=/d' .env; echo "removed legacy GATEWAY_PORT (use PORT)"; fi
sed -i '/^GATEWAY_BIND=/d;/^IMAGE_REGISTRY=/d' .env
default PORT 3650
default BIND_ADDRESS 127.0.0.1
default POSTGRES_DB cheques
default POSTGRES_OWNER_USER cheques_owner
default APP_DB_USER cheques_app
default IMAGE_TAG local
secret API_TOKEN 48
secret POSTGRES_OWNER_PASSWORD 24
secret APP_DB_PASSWORD 24

docker compose --env-file .env up -d --build --remove-orphans

PORT="$(get PORT)"
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
