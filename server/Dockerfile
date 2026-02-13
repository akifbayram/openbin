FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY migrations ./migrations
RUN mkdir -p /data/photos && chown -R node:node /data/photos /app
USER node
EXPOSE 4000
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
