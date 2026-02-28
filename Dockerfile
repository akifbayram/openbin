# ── Stage 1: Build frontend ──────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json biome.json ./
COPY src ./src
COPY public ./public
COPY server/openapi.yaml ./server/openapi.yaml
RUN npx vite build

# ── Stage 2: Build server ────────────────────
FROM node:22-alpine AS server-builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# ── Stage 3: Runtime ─────────────────────────
FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node --from=server-builder /app/package.json /app/package-lock.json* ./
COPY --chown=node:node --from=server-builder /app/node_modules ./node_modules
COPY --chown=node:node --from=server-builder /app/dist ./dist
COPY --chown=node:node server/schema.sql ./schema.sql
COPY --chown=node:node --from=frontend-builder /app/dist ./public
RUN mkdir -p /data/photos /data/backups && chown -R node:node /data
USER node
EXPOSE 1453
CMD ["node", "dist/start.js"]
