# Built from the repo root: docker build -f apps/api/Dockerfile .
# (needs the whole workspace as build context — pnpm workspace deps are real source, not
# published packages). This is an explicit legacy API image recipe, not the active Rust
# server deployment. No image publishing or deployment workflow is enabled.

FROM node:26-slim AS build
# node:26 no longer ships corepack; pin the same pnpm the workspace declares (package.json packageManager).
RUN npm install -g pnpm@11.11.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# tsup bundles @arcadia/{contracts,database,domain} straight into dist/server.js and
# dist/migrate.js (see apps/api/tsup.config.ts's noExternal) — only apps/api's own real npm
# dependencies need to survive into the runtime image, which is exactly what `pnpm deploy`
# isolates below.
RUN pnpm --filter @arcadia/api build
# --legacy: pnpm 10+'s default "injected" deploy needs inject-workspace-packages set repo-wide,
# which this workspace doesn't use — tsup already bundled the workspace deps in above, so a plain
# copy of apps/api's own real npm dependencies (the legacy behavior) is exactly what's needed.
RUN pnpm --filter @arcadia/api deploy --prod --legacy /deploy/api

FROM node:26-slim AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=23101
WORKDIR /app
COPY --from=build /deploy/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
# The Drizzle migration history, so `node dist/migrate.js` (the explicit, never-automatic schema
# step — `podman run --rm ... node dist/migrate.js`, or the arcadia-migrate Quadlet unit) works
# from the image alone.
COPY --from=build /repo/packages/database/drizzle ./drizzle
# Uploaded artwork lives on a mounted volume, never in the image (NAHHASIO_MEDIA_ROOT points here).
RUN mkdir -p /data/media/uploads
ENV NAHHASIO_MEDIA_ROOT=/data/media/uploads
EXPOSE 23101
CMD ["node", "dist/server.js"]
