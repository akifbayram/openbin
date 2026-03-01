# OpenBin

[![CI/CD](https://github.com/akifbayram/openbin/actions/workflows/ci.yml/badge.svg)](https://github.com/akifbayram/openbin/actions/workflows/ci.yml)
[![Docker Image](https://github.com/akifbayram/openbin/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/akifbayram/openbin/pkgs/container/openbin)
[![License: GPL-3.0](https://img.shields.io/github/license/akifbayram/openbin)](LICENSE)
[![Discord](https://img.shields.io/discord/1353217919498424380?logo=discord&label=Discord)](https://discord.gg/W6JPZCqqx9)

Self-hosted inventory system for organizing physical storage bins with QR codes. Print labels, scan to find contents, and optionally connect your own AI to do the heavy lifting: snap a photo and it names the bin, lists every item, and tags it for search. Ask "where are the batteries?" and get an answer.

**[Documentation](https://akifbayram.github.io/openbin/)** | **[Discord](https://discord.gg/W6JPZCqqx9)**

## Features

- **Scan to find** — Camera-based QR scanner or manual short code lookup
- **QR labels** — Generate and print label sheets
- **AI photo analysis** — Snap a photo of a bin and AI names it, lists every item, suggests tags, and adds notes
- **Natural language commands** — "Add screwdriver to the tools bin" or "Move batteries to the garage"
- **Inventory search** — Ask "Where did I put the holiday lights?" and get matching bins with explanations
- **BYO API key** — Connects to OpenAI, Anthropic, Gemini, or any OpenAI-compatible endpoint. Customizable prompts. Fully optional
- **Photo attachments** — Attach up to 5 photos per bin
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
- **MCP Server** — Connect Claude and other AI assistants directly to your inventory via Model Context Protocol
- **PWA** — Installable, add to home screen

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 4 |
| Backend | Express 4, SQLite (better-sqlite3), JWT auth |
| QR | `qrcode` + `html5-qrcode` |
| AI | Self-Hosted, OpenAI, Anthropic, Gemini, or any OpenAI-compatible provider (per-user config) |
| Infra | Docker Compose (single container) |

## Quick Start

**Prerequisites:** Docker

Create a `docker-compose.yml`:

```yaml
services:
  openbin:
    image: ghcr.io/akifbayram/openbin:latest
    ports:
      - "1453:1453"
    volumes:
      - openbin_data:/data
    environment:
      DATABASE_PATH: /data/openbin.db
      PHOTO_STORAGE_PATH: /data/photos
      BACKUP_PATH: /data/backups

volumes:
  openbin_data:
```

```bash
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
cd server && npm run dev   # API server at http://localhost:1453
npm run dev                 # Frontend dev server at http://localhost:5173
```

## Configuration

Optional. Set environment variables or create a `.env` file to override defaults:

| Variable | Description | Default |
|----------|-------------|---------|
| **Server** | | |
| `PORT` | Express server port | `1453` |
| `HOST_PORT` | Docker external port | `1453` |
| `DATABASE_PATH` | SQLite database file path | `./data/openbin.db` |
| `PHOTO_STORAGE_PATH` | Photo upload directory | `./data/photos` |
| `TRUST_PROXY` | Set `true` when behind a reverse proxy | `false` |
| **Authentication** | | |
| `JWT_SECRET` | JWT signing secret; auto-generated and persisted if unset | — |
| `ACCESS_TOKEN_EXPIRES_IN` | Short-lived access token lifetime | `15m` |
| `REFRESH_TOKEN_MAX_DAYS` | Refresh token lifetime in days (1–90) | `7` |
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` |
| `REGISTRATION_ENABLED` | Allow new user registration | `true` |
| **Uploads** | | |
| `MAX_PHOTO_SIZE_MB` | Max photo upload size in MB | `5` |
| `MAX_AVATAR_SIZE_MB` | Max avatar upload size in MB | `2` |
| **AI (server-wide fallback)** | | |
| `AI_PROVIDER` | `openai`, `anthropic`, `gemini`, or `openai-compatible` | — |
| `AI_API_KEY` | API key for the configured provider | — |
| `AI_MODEL` | Model name (e.g. `gpt-4o-mini`, `claude-sonnet-4-6`) | — |
| `AI_ENDPOINT_URL` | Custom endpoint for `openai-compatible` provider | — |
| `AI_ENCRYPTION_KEY` | Encrypts user AI API keys at rest (AES-256-GCM) | — |
| **Backups** | | |
| `BACKUP_ENABLED` | Enable automatic database backups | `false` |
| `BACKUP_INTERVAL` | Backup schedule (hourly/daily/weekly/cron) | `daily` |
| `BACKUP_RETENTION` | Backup retention in days | `7` |
| `BACKUP_WEBHOOK_URL` | Webhook URL for backup notifications | — |

See [`.env.example`](.env.example) for the full list of supported variables.

## Updating

```bash
docker compose pull
docker compose up -d
```

The database schema is auto-migrated on startup. Your data volume is preserved across updates.

## API Documentation

OpenAPI spec at [`server/openapi.yaml`](server/openapi.yaml). Swagger UI available at `/api-docs/` when running behind Nginx.

See the full [API reference](https://akifbayram.github.io/openbin/api/) in the docs.

## License

[GPL-3.0](LICENSE)
