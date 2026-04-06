# ── Stage 1: Build frontend ──────────────────
FROM node:22-alpine AS frontend-builder
ARG BUILD_EDITION=selfhosted
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src
COPY public ./public
COPY server/openapi.yaml ./server/openapi.yaml
RUN BUILD_EDITION=$BUILD_EDITION npx vite build

# ── Stage 2: Build server ────────────────────
FROM node:22-alpine AS server-builder
ARG BUILD_EDITION=selfhosted
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build
RUN if [ "$BUILD_EDITION" != "cloud" ]; then rm -rf dist/ee; fi

# ── Stage 3: Runtime ─────────────────────────
FROM node:22-alpine
RUN apk add --no-cache postgresql-client
WORKDIR /app
COPY --chown=node:node --from=server-builder /app/package.json /app/package-lock.json* ./
COPY --chown=node:node --from=server-builder /app/node_modules ./node_modules
COPY --chown=node:node --from=server-builder /app/dist ./dist
COPY --chown=node:node server/schema.sqlite.sql server/schema.pg.sql ./
COPY --chown=node:node --from=frontend-builder /app/dist ./public
RUN mkdir -p /data/photos /data/backups && chown -R node:node /data
USER node
EXPOSE 1453
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:1453/api/health || exit 1
CMD ["node", "dist/start.js"]
