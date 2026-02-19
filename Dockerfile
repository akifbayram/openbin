# ── Stage 1: Build frontend ──────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json biome.json ./
COPY src ./src
COPY public ./public
RUN npx vite build

# ── Stage 2: Build server ────────────────────
FROM node:20-alpine AS server-builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# ── Stage 3: Runtime ─────────────────────────
FROM node:20-alpine
WORKDIR /app
COPY --from=server-builder /app/package.json /app/package-lock.json* ./
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/dist ./dist
COPY server/migrations ./migrations
COPY --from=frontend-builder /app/dist ./public
RUN mkdir -p /data/photos /data/backups && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["sh", "-c", "node dist/migrate.js && node dist/start.js"]
