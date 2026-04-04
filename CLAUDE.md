# OpenBin

## Project Overview

Inventory with intelligence. Multi-user web app for organizing physical storage bins with QR codes and photo recognition. Data persists in SQLite via Express API. Flat material design system.

**Core flows**: Register/login -> Create/join location -> Create bin -> Print QR label -> Scan to find contents.

## Architecture

- **Client**: React 18 + TypeScript 5 (strict) + Vite 6, Tailwind CSS 4, react-router-dom 6 (BrowserRouter)
- **Server**: Express 4, SQLite (better-sqlite3) or PostgreSQL (pg), JWT auth, express-rate-limit
- **Database engine**: Set `DATABASE_URL` env var for PostgreSQL; omit for SQLite. Engine is locked after first init (cannot switch). Dialect abstraction in `server/src/db/dialect.ts` (`d` object) handles SQL differences.
- **Docker**: Single container (Express serves static frontend + API), reverse proxy optional
- Features live in `src/features/`, server code in `server/src/`, shared types in @src/types.ts
- No ESLint or Prettier — single root `biome.json` covers both `src/` and `server/src/`.

## Code Conventions

- **Named exports only** — no default exports except `App.tsx`.
- **Feature hooks pattern**: each feature exposes a hook (e.g. `useBinList`) for data via `apiFetch()` with event-based refresh, and plain async functions (e.g. `addBin`) for mutations. Same file.
- **Data hooks return `{ data, isLoading }`** — e.g. `useBinList()` → `{ bins, isLoading }`.
- **Key utilities**: `apiFetch()` in `lib/api.ts`, `useAuth()` in `lib/auth.tsx`, `useAppSettings()` in `lib/appSettings.ts`, `LocationProvider` in `features/locations/useLocations.tsx`, `usePermissions()` in `lib/usePermissions.ts`, `cn()` in `lib/utils.ts`. Read the source for signatures.
- **Soft deletes**: `DELETE /api/bins/:id` sets `deleted_at`. All bin queries filter `WHERE deleted_at IS NULL`.
- **API response envelopes**: Lists return `{ results: T[], count }`. Errors return `{ error: "CODE", message }`. See `server/openapi.yaml` for details.
- **CSS**: use `var(--token)` design tokens, not raw colors. Surface classes `flat-card`, `flat-nav`, `flat-heavy`, `flat-popover` provide opaque backgrounds with solid borders — no blur, no shadow. Use `cn()` from `lib/utils.ts` (clsx + tailwind-merge) for className composition. **Do not** add `backdrop-blur-*`, `shadow-*`, or `rounded-full` (except pills/avatars) — the design is deliberately flat.
- **Border tokens**: `--border-flat` for structural/container borders (cards, inputs, pickers, panels). `--border-subtle` for internal separators (dividers between list items, section breaks within a card).
- **Radius tokens**: `--radius-xs` (4px) through `--radius-xl` (12px), `--radius-full` (9999px). Use `var(--radius-*)` instead of hardcoded values or Tailwind `rounded-*`.
- **Shared class constants** in `lib/utils.ts`: `inputBase` (form controls), `flatCard`, `focusRing`, `focusRingInset`, `categoryHeader`, `iconButton`, `rowAction`, `overlayBackdrop`, `disclosureSectionLabel`. Use these instead of hand-rolling the same patterns.
- **Icons**: `lucide-react` — import named icons (e.g. `import { Plus } from 'lucide-react'`).
- **Responsive**: mobile-first. Breakpoint `lg` (1024px).
- **Server error handling**: Routes use `throw new ValidationError(...)` etc. from `server/src/lib/httpErrors.ts`, wrapped in `asyncHandler()` to forward to the global error handler.
- **Event bus**: `notify()` and `useRefreshOn()` from `lib/eventBus.ts`. 9 event types: `BINS`, `LOCATIONS`, `PHOTOS`, `PINS`, `AREAS`, `TAG_COLORS`, `SCAN_HISTORY`, `CUSTOM_FIELDS`, `PLAN`.

## API Documentation

OpenAPI spec at `server/openapi.yaml`.

## Gotchas

- **Theme**: `localStorage('openbin-theme')`, applied via `<html class="dark|light">` before first paint. `useTheme()` in `lib/theme.ts` is runtime source of truth.
- **`html5-qrcode`** is ~330KB gzipped — always dynamic-import the scanner page.
- **Photos served via API**: `getPhotoUrl(id)` → `/api/photos/${id}/file`. Auth via httpOnly cookies (no query param).
- **BrowserRouter**: path-based URLs. QR scanner regex handles both old hash and new path URLs.
- **Env var reference**: See @.env.example for all env vars (backup, auth, AI, uploads, rate limiting).
- **Route mounting**: Photos upload on bins router (`POST /api/bins/:id/photos`). Export at `/api`. Areas at `/api/locations`.
- **Server config**: All env vars parsed and validated in `server/src/lib/config.ts` with safe defaults. See `.env.example` for the full list.
- **Docker volume permissions**: Container runs as `node` (uid 1000). Volume-mounted dirs must be owned by 1000:1000 or the app will crash with EACCES.
- **`DATABASE_PATH`**: Must be set to `/data/openbin.db` in Docker. The SQLite init code creates this directory; the path is also used by `resolveJwtSecret()` to locate `.jwt_secret`, so it matters even with PostgreSQL.
- **`JWT_SECRET`**: Set explicitly in Docker. Auto-generation writes to `data/.jwt_secret` which fails if the data dir isn't writable yet at config load time.
- **`CORS_ORIGIN`**: Defaults to `http://localhost:5173`. Must be set to the production URL (e.g. `https://cloud.openbin.app`) in deployment — otherwise the dev origin leaks into production ACAO headers.
- **Thumbnail generation**: Worker pool via `piscina` (`server/src/lib/thumbnailPool.ts`). Sharp runs off-main-thread to avoid blocking the event loop.
- **Export streaming**: Large exports stream JSON via `res.write()` to prevent OOM. Don't buffer the full response in `server/src/routes/export.ts`.

## Security (non-obvious)

- **JWT secret** auto-generated and persisted to `/data/.jwt_secret` if `JWT_SECRET` env var unset.
- **AI API key encryption**: AES-256-GCM when `AI_ENCRYPTION_KEY` env var set. Graceful fallback to plaintext.
- **Dual auth**: Middleware supports JWT tokens and API keys (`sk_openbin_` prefix). `req.authMethod` is `'jwt' | 'api_key'`.
- **Roles**: Three-tier role system — `admin`, `member`, `viewer`. Viewers are read-only (no create/edit/delete/pin). Use `usePermissions()` hook for client-side guards and `requireMemberOrAbove()` middleware for server-side.
- **SSRF protection**: AI provider calls use `undici` Agent with DNS pinning (`server/src/lib/aiCaller.ts`). Resolved IPs are pinned at request time to close TOCTOU gap. Self-hosted mode skips validation (allows local endpoints like Ollama).
- **Registration modes**: `REGISTRATION_MODE` env var — `open` (default), `invite` (require location invite code), `closed` (no sign-ups).

## Development

```sh
npm install && cd server && npm install  # Install both client + server deps
npm run dev:all                           # Start API (port 1453) + Vite dev server concurrently
npm run dev                               # Vite dev server only (port 5173)
npm run dev:server                        # API server only (port 1453, tsx watch)
```

- Path alias: `@/*` → `src/*` (configured in `tsconfig.json`, resolved by Vite).
- PWA enabled via `vite-plugin-pwa` — service worker registered in production builds.

## Verification

```sh
npx biome check .             # Lint & format check
npx tsc --noEmit              # Frontend type check
npx vitest run                # Frontend tests (happy-dom, not jsdom)
cd server && npx vitest run   # Server tests
npx vite build                # Production build
cd server && npx tsc --noEmit # Server type check
docker compose up -d          # Full stack
```

- **Docker image publish**: Push a `v*` tag to trigger `.github/workflows/docker-publish.yml` → builds multi-arch image to `ghcr.io/akifbayram/openbin`.
- **Commit messages**: No parentheses in commit prefixes — use `feat: description` not `feat(area): description`.
- Run `npm run check` (frontend + server type check) and `npx biome check .` before committing. Run `npx vitest run path/to/test` for targeted tests over the full suite.
- When compacting context, preserve the full list of modified files and any failing test output.

## Testing

- Vitest 4 + happy-dom. Tests mock `apiFetch` from `@/lib/api` and `useAuth` from `@/lib/auth`.
- Test files in `__tests__/` directories next to feature code.