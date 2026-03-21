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

Set `HOST_PORT` in your `.env` file (e.g. `HOST_PORT=8080`) and restart the container. See [Configuration](./configuration) for all options.

## Updating

Pull the latest image and restart:

```bash
docker compose pull
docker compose up -d
```

The database and all data on the volume are preserved.

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

### What's in a backup archive

Each automatic backup is a ZIP file named `backup-YYYY-MM-DDTHHMMSS.zip` containing:

| Path in ZIP | Description |
|-------------|-------------|
| `openbin.db` | Full SQLite database snapshot (users, bins, locations, tags, etc.) |
| `photos/` | All uploaded photos and generated thumbnails, organized by bin ID |

::: info JWT secret not included
The JWT signing secret (`.jwt_secret`) is **not** included in backup archives. See [Restoring the JWT secret](#restoring-the-jwt-secret) below.
:::

## Restore

### Quick restore (Docker)

1. **Stop the container** to prevent writes during restore:

   ```bash
   docker compose down
   ```

2. **Find the backup** on the Docker volume. If you kept backups on the default volume:

   ```bash
   # List available backups
   docker run --rm -v openbin_api_data:/data alpine ls /data/backups/
   ```

   If you copied backups off-host, use your local copy.

3. **Extract the database and photos** into the data volume, replacing existing files:

   ```bash
   # Extract from backup into a temp directory
   mkdir -p /tmp/openbin-restore
   unzip backup-2026-03-15T020000.zip -d /tmp/openbin-restore

   # Copy into the Docker volume
   docker run --rm \
     -v openbin_api_data:/data \
     -v /tmp/openbin-restore:/restore \
     alpine sh -c "cp /restore/openbin.db /data/openbin.db && \
                    rm -rf /data/photos && \
                    cp -r /restore/photos /data/photos && \
                    chown -R 1000:1000 /data"
   ```

   ::: tip Volume name
   The volume name is typically `openbin_api_data` or `qrcode_api_data` depending on your project directory name. Run `docker volume ls` to find the correct name.
   :::

4. **Start the container**:

   ```bash
   docker compose up -d
   ```

5. **Verify** by logging in and checking your bins, photos, and user accounts.

### Restoring the JWT secret

The `.jwt_secret` file lives at `/data/.jwt_secret` and is **not included** in backup archives. This secret signs all JWT tokens — if it changes, every user session is invalidated and users must log in again.

**If you still have the original volume** (e.g. you're restoring just the database), the `.jwt_secret` file is already in place. No action needed.

**If the volume was lost**, you have two options:

| Scenario | What to do |
|----------|------------|
| You set `JWT_SECRET` in `.env` | Nothing — the env var takes precedence over the file. Sessions survive as long as the env var stays the same. |
| You relied on the auto-generated secret | The secret is gone. OpenBin will generate a new one on next startup. All existing sessions become invalid — users will need to log in again. No data is lost. |

::: tip Recommendation
For production deployments, set `JWT_SECRET` explicitly in your `.env` file and include your `.env` file in your off-host backup strategy. This ensures sessions survive even a full volume loss.
:::

### Restoring without Docker

If you run OpenBin directly (no container), extract the backup and place the files where your environment variables point:

```bash
# Stop the server process first
unzip backup-2026-03-15T020000.zip -d /tmp/openbin-restore

# Copy database (default: ./data/openbin.db)
cp /tmp/openbin-restore/openbin.db ./data/openbin.db

# Copy photos (default: ./uploads)
rm -rf ./uploads
cp -r /tmp/openbin-restore/photos ./uploads
```

Then start the server. Check `DATABASE_PATH` and `PHOTO_STORAGE_PATH` in your `.env` if you use non-default paths.

### Verifying a restore

After starting OpenBin on restored data:

1. **Log in** — if login fails, the JWT secret changed (see above). Users can log in again with their existing passwords.
2. **Check bins** — open a bin and confirm items, tags, and notes are present.
3. **Check photos** — open a bin with photos and verify they load. Thumbnails are regenerated automatically if missing.
4. **Check user accounts** — all registered users and their roles should be intact (stored in the database).

## Running Behind a Reverse Proxy

If you place OpenBin behind Nginx, Caddy, or another reverse proxy, set `TRUST_PROXY=true` in your `.env` file so that rate limiting and secure cookie handling work correctly:

```bash
TRUST_PROXY=true
```

See [Reverse Proxy](./reverse-proxy) for copy-paste configs for Nginx, Caddy, and Traefik.
