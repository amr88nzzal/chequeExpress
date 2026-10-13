# syntax=docker/dockerfile:1.7
# Build context is the repository root:  docker build -f apps/web/Dockerfile .
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
# The pnpm version MUST match `packageManager` in the root package.json; a
# mismatch makes pnpm download the other version's prebuilt binary at install
# time, which is the failure that broke the api image (missing libatomic.so.1).
RUN npm install -g pnpm@11.7.0
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
# Scripts are NOT skipped here (unlike the api image): esbuild links its platform
# binary and @swc/core loads its native binding through install-time scripts, and
# the Vite build needs both. pnpm-workspace.yaml allowlists exactly those two, so
# every other dependency's script stays blocked.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @cheques/web...
COPY apps/web ./apps/web
RUN pnpm --filter @cheques/web run build

# The SPA is static; nginx serves it and falls back to index.html so the
# BrowserRouter's client-side routes survive a hard refresh.
FROM nginx:1.27-alpine AS runtime
COPY infra/gateway/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
