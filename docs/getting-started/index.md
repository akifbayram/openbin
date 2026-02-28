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

Once OpenBin is running at `http://localhost:1453`, follow these steps to get organized:

1. **Register an account** — Click "Register" on the login page and create your user account. The first user to register can create and manage locations.

2. **Create a location** — A location represents a physical place (home, workshop, storage unit). Go to the Locations screen and create your first one. Share the invite code with others who need access.

3. **Add bins** — Inside your location, create bins for your physical containers. Give each bin a name, add the items it contains, and assign tags or an area to help with search later.

4. **Print QR labels** — Navigate to the Print page, select the bins you want labels for, choose a label format, and print. Stick the labels on your physical bins.

5. **Scan to find** — Use the built-in QR scanner or type a short code to instantly see what's in any bin.

::: tip AI features
If you have an API key for OpenAI, Anthropic, or Gemini, configure it in your profile settings. You can then snap a photo of a bin's contents and have AI fill in the name, items, tags, and notes automatically.
:::

::: warning Multi-user access
Only admins can invite new members to a location. Share your location's invite code from the Location Settings page.
:::

## Next Steps

See the [User Guide](/guide/) for a full walkthrough of every feature, including AI setup, bulk operations, export/import, and API key access.
