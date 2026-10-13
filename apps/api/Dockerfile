# syntax=docker/dockerfile:1.7
# Build context is the repository root:  docker build -f apps/api/Dockerfile .
# Multi-arch friendly (linux/arm64 first, linux/amd64 for development). No native deps today.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
# `libatomic1` is not part of the slim image and pnpm's prebuilt binary can link
# against it; without it `pnpm install` dies with exit 127 and
#   "…/@pnpm/exe/pnpm: error while loading shared libraries: libatomic.so.1".
# `apt-get update` is kept non-fatal so a transient mirror problem cannot block
# the whole build over a package that is usually already present.
RUN apt-get update -o Acquire::Retries=3 || echo "apt-get update failed; continuing" \
 && apt-get install -y --no-install-recommends libatomic1 \
 || echo "libatomic1 unavailable; continuing" \
 && rm -rf /var/lib/apt/lists/*
# The version MUST match `packageManager` in the root package.json. When they
# disagree, pnpm sees the mismatch and downloads the other version's prebuilt
# binary at install time — which is what selected the library-less binary above.
RUN npm install -g pnpm@11.7.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
# Production deps only. The workspace layout is kept (no `pnpm deploy`) because Node's
# type stripping refuses .ts files that live under node_modules.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @cheques/api...

FROM base AS runtime
ENV NODE_ENV=production PORT=3650
# Take the whole installed workspace from the deps stage (node_modules + symlinks), then add sources.
# Not copying individual node_modules folders: packages without dependencies (e.g. shared) have none.
COPY --from=deps /app ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
USER node
WORKDIR /app/apps/api
EXPOSE 3650
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/main.ts"]
