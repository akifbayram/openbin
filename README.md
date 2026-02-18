# OpenBin

Self-hosted inventory system for organizing physical storage bins with QR codes. Print labels, stick them on containers, and scan to instantly look up contents. Snap a photo and let AI catalog the contents. Multi-user with shared locations.

## Features

- **Scan to find** — Camera-based QR scanner or manual short code lookup
- **QR labels** — Generate and print label sheets (Avery 5160/5163/5167 + custom sizes)
- **Photo attachments** — Attach photos; optionally use AI to auto-fill bin details
- **Shared locations** — Multi-user with invite codes and per-location areas
- **Dashboard** — Stats, saved searches, pinned bins, recently scanned/updated bins, needs-organizing queue
- **Search & filter** — By name, items, tags, areas, colors; saved views for quick access
- **Bulk add** — Batch bin creation from photos or CSV
- **Bulk operations** — Long-press multi-select for batch tagging, moving, or deleting
- **Export/Import** — JSON or ZIP backup with photos, CSV export
- **Activity log** — Per-location event tracking for bins, photos, and membership changes
- **Trash & recovery** — Soft deletes with restore; automatic purge after retention period
- **API keys** — Long-lived tokens for headless or automation access
- **Customizable terminology** — Rename "Bins", "Areas", etc. to match your use case
- **Saved views** — Persistent filter/sort presets on the dashboard
- **PWA** — Installable, add to home screen

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 4 |
| Backend | Express 4, SQLite (better-sqlite3), JWT auth |
| QR | `qrcode` + `html5-qrcode` |
| AI | Self-Hosted, OpenAI, Anthropic, Gemini, or any OpenAI-compatible provider (per-user config) |
| Infra | Docker Compose (API + Nginx) |

## Quick Start

**Prerequisites:** Docker

```bash
git clone https://github.com/akifbayram/openbin.git
cd openbin
docker compose up -d
```

Open `http://localhost:1453`. Register an account, create a location, and start adding bins.

No configuration needed — the database is a single file on the Docker volume and JWT secrets are auto-generated and persisted.

### Local Development

**Prerequisites:** Node.js 20+

```bash
npm install                 # Install frontend dependencies
cd server && npm install    # Install server dependencies
```

```bash
cd server && npm run dev   # API server at http://localhost:4000
npm run dev                 # Frontend dev server at http://localhost:5173
```

## Configuration

Optional. Set environment variables or create a `.env` file to override defaults:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Express server port | `4000` |
| `DATABASE_PATH` | SQLite database file path | `./data/openbin.db` |
| `PHOTO_STORAGE_PATH` | Photo upload directory | `./uploads` |
| `JWT_SECRET` | JWT signing secret; auto-generated and persisted to disk if unset | — |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `AI_ENCRYPTION_KEY` | Encrypts AI API keys at rest with AES-256-GCM | — |

## API Documentation

OpenAPI spec at `server/openapi.yaml`. Swagger UI available at `/api-docs/` when running via Nginx.

## License

[GPL-3.0](LICENSE)
