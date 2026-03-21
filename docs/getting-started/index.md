# Getting Started

OpenBin is a self-hosted inventory system for organizing physical storage bins with QR codes. Print labels, scan to find contents, and optionally connect your own AI to automatically name bins, list items, and answer natural-language queries like "where are the batteries?". It runs as a single Docker container with no external dependencies — data lives in a SQLite file on a Docker volume.

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Docker | Any recent version | Running OpenBin in production |
| Node.js | 20+ | Local development only |
| Git | Any | Cloning the repository |

::: tip No configuration required
OpenBin works out of the box. The database is created automatically, and JWT secrets are auto-generated and persisted on first run. No environment variables need to be set to get started.
:::

## Choose Your Setup

There are two ways to run OpenBin:

- **[Docker](./docker)** — Recommended for production and everyday use. One command to start, data persisted automatically.
- **[Local Development](./local-dev)** — For contributing to OpenBin or running the frontend and server separately during development.

## First Steps

Once OpenBin is running, register an account, create a location, add bins, and [print QR labels](/guide/print-labels). See the [User Guide](/guide/) for a full walkthrough.

## Next Steps

See the [User Guide](/guide/) for a full walkthrough of every feature, including AI setup, bulk operations, export/import, and API key access.
