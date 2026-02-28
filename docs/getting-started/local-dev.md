# Local Development

Running OpenBin locally without Docker lets you work on the frontend and server simultaneously with hot-module replacement and fast feedback cycles. The frontend dev server proxies API requests to the Express server, so both need to be running.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- Git

## Clone and Install

```bash
git clone https://github.com/akifbayram/openbin.git
cd openbin
npm install          # Install frontend dependencies
cd server && npm install  # Install server dependencies
```

## Run Both Servers

Open two terminal windows.

**Terminal 1 — API server:**

```bash
cd server && npm run dev
```

The Express API starts at `http://localhost:3000`.

**Terminal 2 — Frontend dev server:**

```bash
npm run dev
```

The Vite dev server starts at `http://localhost:5173`. Open this address in your browser.

::: info How the proxy works
The Vite dev server proxies all `/api` requests to `http://localhost:3000` automatically. You only ever open `http://localhost:5173` in your browser during development.
:::

## Environment Variables

Copy `.env.example` to a new `.env` file in the project root and uncomment the variables you need:

```bash
cp .env.example .env
```

Key variables for local development:

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_PATH` | `./data/openbin.db` | SQLite file path; created automatically on first run |
| `CORS_ORIGIN` | `http://localhost:5173` | Must match the Vite dev server URL |
| `PORT` | `3000` | Express server port |
| `REGISTRATION_ENABLED` | `true` | Set to `false` to lock sign-ups |

::: tip
For most local development workflows you do not need a `.env` file at all. The defaults work with the standard Vite + Express setup.
:::

## Type Checking

Run type checks before committing to catch errors across both packages:

```bash
# Frontend
npx tsc --noEmit

# Server
cd server && npx tsc --noEmit
```

::: warning
Always run `npx tsc --noEmit` on the frontend before submitting changes. The project uses TypeScript strict mode, and type errors will block the production build.
:::

## Tests

The project uses [Vitest](https://vitest.dev/) with happy-dom. Run the full test suite:

```bash
npx vitest run
```

Run a specific test file:

```bash
npx vitest run src/features/bins/__tests__/useBins.test.ts
```

Tests mock `apiFetch` from `@/lib/api` and `useAuth` from `@/lib/auth`. No running server or database is needed to execute tests.

## Production Build

Build the frontend for production:

```bash
npx vite build
```

The output lands in `dist/`. In production (and in Docker), Express serves this directory as static files.

## Linting

The project uses [Biome](https://biomejs.dev/) for linting and formatting — not ESLint or Prettier.

```bash
npx biome check src/
```

To apply auto-fixes:

```bash
npx biome check --write src/
```

::: info
The `biome.json` in the project root contains all lint and format rules. Do not add ESLint or Prettier configuration files.
:::

## Project Structure

```
openbin/
├── src/              # React frontend (TypeScript)
│   ├── features/     # Feature modules (bins, locations, print, etc.)
│   ├── components/   # Shared UI components
│   └── lib/          # Utilities (api, auth, eventBus, etc.)
├── server/
│   └── src/          # Express API (TypeScript)
├── docs/             # This documentation site (VitePress)
└── docker-compose.yml
```
