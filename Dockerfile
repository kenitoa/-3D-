FROM node:22.22.3-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run typecheck && npm run build

FROM node:22.22.3-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8765 CAMPUS_BIND_HOST=0.0.0.0 CAMPUS_DB_PATH=/app/var/campus.sqlite
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server/platform.mjs ./server/platform.mjs
COPY --from=build --chown=node:node /app/server/migrations ./server/migrations
COPY --from=build --chown=node:node /app/src/data ./src/data
COPY --from=build --chown=node:node /app/src/domain ./src/domain
COPY --from=build --chown=node:node /app/scripts/serve.mjs /app/scripts/static-assets.mjs /app/scripts/server-health.mjs /app/scripts/manage-platform.mjs /app/scripts/container-health.mjs ./scripts/
RUN mkdir -p /app/var && chown node:node /app/var
USER node
EXPOSE 8765
VOLUME ["/app/var"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node","scripts/container-health.mjs"]
CMD ["node","scripts/serve.mjs","--dist","--platform"]
