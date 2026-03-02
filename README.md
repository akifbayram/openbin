# OpenBin

Self-hosted inventory system for organizing physical storage bins with QR codes. Print labels, scan to find contents, and optionally connect your own AI to do the heavy lifting: snap a photo and it names the bin, lists every item, and tags it for search. Ask "where are the batteries?" and get an answer.

**[Documentation](https://akifbayram.github.io/openbin/)** | **[Discord](https://discord.gg/W6JPZCqqx9)**

## Features

- **AI-powered cataloging** - Snap a photo and AI names the bin, lists every item, and tags it. Ask "where are the batteries?" or say "move the drill to the garage." Fully optional
- **Print & scan QR labels** - Generate label sheets, stick them on bins, scan with your phone camera to instantly see contents
- **Multi-user locations** - Share a location with invite codes, split bins into areas, track all changes in the activity log
- **MCP server included** - Connect Claude and other AI assistants directly to your inventory via Model Context Protocol
- **Your data, your server** - Single Docker container, single SQLite file, full JSON/ZIP export with photos. BYO AI.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 4 |
| Backend | Express 4, SQLite (better-sqlite3), JWT auth |

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

## AI Disclosure

The majority of this codebase, including features, tests, and documentation, was written by AI ([Claude Code](https://docs.anthropic.com/en/docs/claude-code)). A human directs architecture, priorities, and design decisions but has not reviewed most code line-by-line. Type checking, linting, and an automated test suite serve as the primary quality gates.

The full source is available for you to audit. If you find a bug or security issue, please [open an issue](https://github.com/akifbayram/openbin/issues).

## License

[GPL-3.0](LICENSE)
