<h1>
  <img src="public/logo.svg" alt="" width="28" />&nbsp;<span style="font-size:32px;line-height:32px;">OpenBin</span>
</h1>

Self-hosted inventory system for organizing physical storage bins with optional AI-powered cataloging. Snap photos and AI names the bins, lists every item, and tags them for search. Tell it to "add batteries to the tools bin" or "move everything to the garage" and review changes before applying. Reorganize entire locations with AI suggestions. Print QR labels and scan to find contents.

<a href="https://demo.openbin.app"><strong>Demo</strong></a> · <a href="https://akifbayram.github.io/openbin/"><strong>Docs</strong></a> · <a href="https://discord.gg/W6JPZCqqx9"><strong>Discord</strong></a>

## Highlights

- **AI-powered cataloging** — Point your phone at a bin and AI fills in the name, items with quantities, and tags. Bring your own API key.
- **Natural language commands** — "Add batteries to the tools bin" or "move everything to the garage"
- **AI reorganization** — Let AI suggest how to restructure an entire location's bins, areas, and tags, then apply changes in bulk
- **Print & scan QR labels** — Generate customizable label sheets, stick them on bins, scan with your phone to see contents
- **Multi-user locations** — Invite others with a code, assign roles (admin/member/viewer), split bins into areas, track changes in the activity log
- **MCP server included** — Connect Claude and other AI assistants directly to your inventory via Model Context Protocol
- **Export everything** — Full JSON/CSV/ZIP export with photos, import from backup anytime

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
      - api_data:/data
    environment:
      DATABASE_PATH: /data/openbin.db
      PHOTO_STORAGE_PATH: /data/photos
      BACKUP_PATH: /data/backups

volumes:
  api_data:
```

```bash
docker compose up -d
```

Open `http://localhost:1453`. Register an account, create a location, and start adding bins.

## Configuration

All settings are optional. Set environment variables or create a `.env` file to override defaults. See [`.env.example`](.env.example) for the full list.

<details>
<summary>Environment variables</summary>

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
| `BCRYPT_ROUNDS` | Password hashing rounds (10–31) | `12` |
| `REGISTRATION_MODE` | Registration policy: `open`, `invite` (require location invite code), or `closed` | `open` |
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
| `BACKUP_RETENTION` | Number of backup files to keep | `7` |
| `BACKUP_WEBHOOK_URL` | Webhook URL for backup notifications | — |
| **Rate Limiting** | | |
| `AI_RATE_LIMIT` | Max AI requests per hour per user | `30` |
| `AI_RATE_LIMIT_API_KEY` | Max AI requests per hour per API key | `1000` |
| `DISABLE_RATE_LIMIT` | Set `true` to disable all rate limiters (dev only) | `false` |
| **Demo** | | |
| `DEMO_MODE` | Auto-login visitors with pre-populated sample data; resets on restart | `false` |

</details>

## Updating

```bash
docker compose pull
docker compose up -d
```

The database schema is auto-migrated on startup. Your data volume is preserved across updates.

## Architecture

Single Node.js process. All data lives in one SQLite file and a photos directory. No external services, no background workers, no telemetry, no phoning home. The app never makes outbound network requests unless you explicitly configure AI features (bring-your-own API key). Works fully offline on a LAN.

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 4 |
| Backend | Express 4, SQLite (better-sqlite3), JWT auth |
| Container | Single-stage Alpine image, runs as non-root `node` user |

The `/data` Docker volume contains everything persistent:

```
/data
├── openbin.db        ← single database file (WAL journal)
├── .jwt_secret       ← auto-generated if JWT_SECRET unset
├── photos/           ← uploaded images
└── backups/          ← scheduled DB snapshots (opt-in)
```

Zero outbound network connections by default. If you configure an AI provider, the server calls that provider's API on demand.

## API Documentation

OpenAPI spec at [`server/openapi.yaml`](server/openapi.yaml). See the full [API reference](https://akifbayram.github.io/openbin/api/) in the docs.

## Local Development

**Prerequisites:** Node.js 20+

```bash
npm install                 # Install frontend dependencies
cd server && npm install    # Install server dependencies
```

```bash
npm run dev:all            # Both servers concurrently (recommended)
# Or separately in two terminals:
# cd server && npm run dev   API server at http://localhost:1453
# npm run dev                Frontend dev server at http://localhost:5173
```

## AI Disclosure

Most of this codebase—features, tests, documentation—was written by AI. A human directs architecture, priorities, and design decisions but has not reviewed most code line-by-line. Type checking, linting, and an automated test suite are the primary quality gates.

## License

[AGPL-3.0](LICENSE)
