# Sanduk

Self-hosted inventory system for organizing physical storage bins with QR codes. Print labels, stick them on containers, and scan to instantly look up contents. Multi-user with shared locations.

## Features

- **QR labels** — Generate and print label sheets (Avery 5160/5163/5167 + custom sizes)
- **Scan to find** — Camera-based QR scanner or manual short code lookup
- **Shared locations** — Multi-user with invite codes and per-location areas
- **Photo attachments** — Attach photos; optionally use AI (OpenAI, Anthropic, or compatible) to auto-fill bin details
- **Search & filter** — By name, items, tags, areas, colors; saved views for quick access
- **Bulk operations** — Long-press multi-select for batch tagging, moving, or deleting
- **Dashboard** — Stats, area breakdown, recently scanned/updated bins, needs-organizing queue
- **Export/Import** — JSON or ZIP backup with photos, CSV export
- **PWA** — Installable, offline-capable

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 4 |
| Backend | Express 4, SQLite (better-sqlite3), JWT auth |
| QR | `qrcode` + `html5-qrcode` |
| AI | OpenAI, Anthropic, or any OpenAI-compatible provider (per-user config) |
| Infra | Docker Compose (API + Nginx) |

## Quick Start

**Prerequisites:** Docker, Node.js 18+

```bash
git clone https://github.com/akifbayram/sanduk.git
cd sanduk

npm install && npm run build
docker compose up -d
```

Open `http://localhost`. Register an account, create a location, and start adding bins.

No configuration needed — the database is a single file on the Docker volume and JWT secrets are auto-generated and persisted.

### Local Development

```bash
cd server && npm run dev   # API server at http://localhost:4000
npm run dev                 # Frontend dev server at http://localhost:5173
```

## Configuration

Optional. Create a `.env` file to override defaults:

| Variable | Description |
|----------|-------------|
| `CORS_ORIGIN` | Allowed CORS origin (default: `http://localhost:3000`) |
| `AI_ENCRYPTION_KEY` | Encrypts AI API keys at rest with AES-256-GCM |

## API Documentation

OpenAPI spec at `server/openapi.yaml`. Swagger UI available at `/api-docs/` when running via Nginx.

## License

[MIT](LICENSE)
