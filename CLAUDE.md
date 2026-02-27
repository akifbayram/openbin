# OpenBin

## Project Overview

Multi-user web app for organizing physical storage bins with QR codes. Data persists in SQLite via Express API. Liquid Glass design system.

**Core flows**: Register/login -> Create/join location -> Create bin -> Print QR label -> Scan to find contents.

## Architecture

- **Client**: React 18 + TypeScript 5 (strict) + Vite 5, Tailwind CSS 4, react-router-dom 6 (BrowserRouter)
- **Server**: Express 4, SQLite (better-sqlite3), JWT auth, express-rate-limit
- **Docker**: Single container (Express serves static frontend + API), reverse proxy optional
- Features live in `src/features/`, server code in `server/src/`, shared types in @src/types.ts
- No external component libraries — build UI primitives in `src/components/ui/`.
- No ESLint or Prettier — Biome handles linting (`biome.json`).

## Code Conventions

- **Named exports only** — no default exports except `App.tsx`.
- **Feature hooks pattern**: each feature exposes a hook (e.g. `useBinList`) for data via `apiFetch()` with event-based refresh, and plain async functions (e.g. `addBin`) for mutations. Same file.
- **Data hooks return `{ data, isLoading }`** — e.g. `useBinList()` → `{ bins, isLoading }`.
- **Key utilities**: `apiFetch()` in `lib/api.ts`, `useAuth()` in `lib/auth.tsx`, `useAppSettings()` in `lib/appSettings.ts`, `LocationProvider` in `features/locations/useLocations.tsx`. Read the source for signatures.
- **Soft deletes**: `DELETE /api/bins/:id` sets `deleted_at`. All bin queries filter `WHERE deleted_at IS NULL`.
- **API response envelopes**: Lists return `{ results: T[], count }`. Errors return `{ error: "CODE", message }`. See `server/openapi.yaml` for details.
- **CSS**: use `var(--token)` design tokens, not raw colors. Glass effects via `glass-card`, `glass-nav`, `glass-heavy`.
- **Responsive**: mobile-first. Breakpoint `lg` (1024px) — bottom nav on mobile, sidebar on desktop.
- **Server error handling**: Routes use `throw new ValidationError(...)` etc. from `server/src/lib/httpErrors.ts`, wrapped in `asyncHandler()` to forward to the global error handler.
- **Event bus**: `notify()` and `useRefreshOn()` from `lib/eventBus.ts`. 7 event types: `BINS`, `LOCATIONS`, `PHOTOS`, `PINS`, `AREAS`, `TAG_COLORS`, `SCAN_HISTORY`.

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

## Security (non-obvious)

- **JWT secret** auto-generated and persisted to `/data/.jwt_secret` if `JWT_SECRET` env var unset.
- **AI API key encryption**: AES-256-GCM when `AI_ENCRYPTION_KEY` env var set. Graceful fallback to plaintext.
- **Dual auth**: Middleware supports JWT tokens and API keys (`sk_openbin_` prefix). `req.authMethod` is `'jwt' | 'api_key'`.

## Verification

```sh
npx tsc --noEmit              # Frontend type check
npx vitest run                # Tests (happy-dom, not jsdom)
npx vite build                # Production build
cd server && npx tsc --noEmit # Server type check
docker compose up -d          # Full stack
```

- Run `npx tsc --noEmit` before committing. Run `npx vitest run path/to/test` for targeted tests over the full suite.
- When compacting context, preserve the full list of modified files and any failing test output.

## Testing

- Vitest 4 + happy-dom. Tests mock `apiFetch` from `@/lib/api` and `useAuth` from `@/lib/auth`.
- Test files in `__tests__/` directories next to feature code.
