# infra: Docker Compose and deployment (C0 task 2)

## Quick start on the server (builds from source, port 3600)
```
git clone https://github.com/amr88nzzal/chequeExpress.git && cd chequeExpress
bash infra/start.sh
curl http://localhost:3600/health/live
```
Requires Docker with the compose plugin. The first run creates `infra/.env` with a random database password.
Stop: `cd infra && docker compose down` (data stays in the `pgdata` volume; add `-v` to wipe it).

## Files
- `docker-compose.yml`: postgres, api, gateway (nginx on host port 3600). worker and render join later.
- `gateway/`: nginx config. TLS is expected from the Cloudflare Tunnel, not nginx.
- `start.sh`: build, start and health-check on the server.
- `deploy.sh` + `.github/workflows/*`: remote deploy from CI with prebuilt images (later).

**Status:** written, NOT yet run on a server. Verify with `start.sh` and record the output in docs/PLAN.md.
