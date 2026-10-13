# infra: Docker Compose and deployment

## Quick start on the server (builds from source, port 3650)
```
git clone https://github.com/amr88nzzal/chequeExpress.git && cd chequeExpress
bash infra/start.sh
curl http://localhost:3650/health/live
```
Requires Docker with the compose plugin. `start.sh` creates `infra/.env` and fills every secret with a random value;
it never overwrites values you already set, so it is safe to run again after `git pull`.

## Settings (`infra/.env`, defaults in `infra/.env.example`)
| Key | Default | Meaning |
|---|---|---|
| `PORT` | `3650` | host port of the gateway, and the API's listen port. Point the Cloudflare tunnel at `http://localhost:3650` |
| `BIND_ADDRESS` | `127.0.0.1` | `0.0.0.0` to reach the port from other machines (testing only) |
| `API_TOKEN` | generated | API secret; in production the API refuses a default or short (< 24) value |
| `POSTGRES_DB` | `cheques` | database name |
| `POSTGRES_OWNER_USER` / `_PASSWORD` | `cheques_owner` / generated | owner account (creates the database, runs migrations) |
| `APP_DB_USER` / `_PASSWORD` | `cheques_app` / generated | account the API connects with (the role itself is created in C1) |

Passwords containing `@ : / ? #` must be URL-encoded because they are placed inside `DATABASE_URL`.
Local development (no Docker): copy `apps/api/.env.example` to `apps/api/.env`; `pnpm --filter @cheques/api dev` loads it.

## Files
- `docker-compose.yml`: postgres, api, gateway (nginx). worker and render join later.
- `gateway/default.conf.template`: nginx config, rendered by the image with `API_PORT=$PORT`. TLS comes from the Cloudflare tunnel.
- `start.sh`: prepare `.env`, build, start, health-check. Stop: `cd infra && docker compose down` (data stays in the `pgdata` volume).
- `deploy.sh` + `.github/workflows/*`: remote deploy from CI with prebuilt images (later).
