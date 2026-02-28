# Docker Quick Start

Docker is the recommended way to run OpenBin. A single `docker compose up -d` command starts the server, serves the frontend, and handles data persistence — no additional setup required.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed (Docker Desktop on Mac/Windows, or Docker Engine on Linux)

## Quick Start

```bash
git clone https://github.com/akifbayram/openbin.git
cd openbin
docker compose up -d
```

Then open `http://localhost:1453` in your browser. Register an account and start adding bins.

::: tip First run
On first startup, OpenBin creates the SQLite database and generates a JWT secret automatically. No environment variables need to be set before running.
:::

## Data Persistence

All data is stored in the `api_data` Docker volume, mounted at `/data` inside the container:

| Path inside container | Contents |
|-----------------------|----------|
| `/data/openbin.db` | SQLite database (all bins, locations, users) |
| `/data/photos/` | Uploaded bin and avatar photos |
| `/data/backups/` | Automatic backups (if enabled) |
| `/data/.jwt_secret` | Auto-generated JWT signing secret |

The volume is named `api_data` and is managed by Docker. Data persists across container restarts and updates.

::: warning Backing up your data
To back up manually, copy the contents of the Docker volume or enable the built-in backup feature (see [Configuration](./configuration)). At minimum, preserve the `openbin.db` file — it contains everything except photos.
:::

## Changing the Port

By default, OpenBin is accessible on port `1453`. To use a different port, set `HOST_PORT` in a `.env` file in the project root:

```bash
# .env
HOST_PORT=8080
```

Then restart the container:

```bash
docker compose up -d
```

OpenBin will now be available at `http://localhost:8080`.

## Updating

Pull the latest image and restart:

```bash
docker compose pull
docker compose up -d
```

The database and all data on the volume are preserved.

## Viewing Logs

```bash
docker compose logs -f openbin
```

Press `Ctrl+C` to stop following logs.

## Stopping

```bash
docker compose down
```

This stops and removes the container but leaves the `api_data` volume intact. Your data is not lost.

To stop and remove all data (destructive):

```bash
docker compose down -v
```

::: danger Data loss warning
`docker compose down -v` permanently deletes the `api_data` volume and all your bins, photos, and user data. There is no recovery after this operation.
:::

## Backup

### Manual backup

Copy the Docker volume data to a safe location. The database file is the critical piece:

```bash
docker cp openbin:/data/openbin.db ./openbin-backup.db
```

### Automatic backups

Enable the built-in backup feature by setting environment variables in your `.env` file:

```bash
BACKUP_ENABLED=true
BACKUP_INTERVAL=daily
BACKUP_RETENTION=7
```

Backup files are written to `/data/backups/` inside the container (the `api_data` volume). See [Configuration](./configuration) for the full backup reference.

## Running Behind a Reverse Proxy

If you place OpenBin behind Nginx, Caddy, or another reverse proxy, set `TRUST_PROXY=true` in your `.env` file so that rate limiting and secure cookie handling work correctly:

```bash
TRUST_PROXY=true
```

The API documentation (OpenAPI spec) is available at `server/openapi.yaml`. A Swagger UI is available at `/api-docs/` when running behind Nginx.
