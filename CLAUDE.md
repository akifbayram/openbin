# Sanduk

## Project Overview

Multi-user PWA for organizing physical storage bins. Users register accounts, create/join locations, and share bins with location members. Users create named bins, attach QR codes, scan them to look up contents, and print label sheets. Photos can be attached to bins for visual reference. Data persists in PostgreSQL via Express API. Export/import provides JSON backup. Designed with an iOS 26 Liquid Glass aesthetic for a native-app feel on mobile.

**Core flows**: Register/login -> Create/join a location -> Create bin -> Print QR label -> Stick on container -> Scan to find contents. Attach photos, search/filter by name/tag/content, bulk-select via long-press for batch tag/area/delete operations.

## Architecture

```
Client (React + TypeScript)
  └── All data: apiFetch() → Express API → Postgres
```

**Docker Compose services**: `postgres` (16-alpine), `api` (Express), `nginx` (serves frontend + proxies API)

## Stack

- **Runtime**: React 18 + TypeScript 5 (strict) + Vite 5
- **Styling**: Tailwind CSS 4 with CSS custom properties (iOS 26 Liquid Glass design system)
- **Server**: Express 4, PostgreSQL 16, JWT auth (bcrypt + jsonwebtoken), express-rate-limit
- **Routing**: react-router-dom 6 (BrowserRouter), lazy-loaded routes
- **QR**: `qrcode` (generation), `html5-qrcode` (scanning)
- **PWA**: vite-plugin-pwa
- **Icons**: lucide-react
- **No component library** — all UI primitives hand-rolled in `src/components/ui/`

## Project Structure

```
src/
  components/ui/    # Reusable primitives (button, card, dialog, input, toast, etc.)
  features/         # Feature modules — each owns its pages, hooks, and helpers
    ai/             # AiSettingsSection, AiSuggestionsPanel, useAiSettings, useAiAnalysis
    auth/           # LoginPage, RegisterPage, AuthGuard
    areas/          # AreaPicker, useAreas (CRUD areas within locations)
    bins/           # BinListPage, BinDetailPage, useBins, BinCard, TagInput, IconPicker, ColorPicker
    dashboard/      # DashboardPage (dashboard with stats, quick scan, recent bins), useDashboard
    items/          # ItemsPage (cross-bin item index)
    locations/      # LocationSelector, LocationMembersDialog, useLocations (no dedicated page — managed in Settings)
    onboarding/     # OnboardingOverlay, ScanSuccessOverlay, useOnboarding
    photos/         # PhotoGallery, PhotoLightbox, usePhotos, compressImage
    profile/        # ProfilePage (avatar, display name, email, password change)
    tags/           # TagColorsContext, TagColorPicker, TagsPage, useTagColors
    qrcode/         # QRScannerPage, QRCodeDisplay, Html5QrcodePlugin
    print/          # PrintPage, LabelSheet, LabelCell, labelFormats
    settings/       # SettingsPage (includes full location CRUD: create, join, rename, delete, members), exportImport
    layout/         # AppLayout, Sidebar, BottomNav
  lib/              # Shared utilities (utils.ts, theme.ts, api.ts, auth.tsx, qr.ts, navItems.ts, constants.ts, iconMap.ts, colorPalette.ts, appSettings.ts, useDebounce.ts, useOnlineStatus.ts)
  types.ts          # All shared interfaces
server/
  src/              # Express API server
    index.ts        # App entry, route mounting
    db.ts           # pg Pool singleton
    migrate.ts      # SQL migration runner
    middleware/      # auth.ts (JWT), locationAccess.ts (location membership)
    routes/         # auth, locations, bins, photos, shapes, export, tagColors, ai
    lib/            # aiProviders.ts
  migrations/       # SQL migration files (001_initial.sql, 002_user_ai_settings.sql)
  Dockerfile        # Multi-stage build
docker-compose.yml  # Postgres, API, nginx
nginx.conf          # Reverse proxy config
.env.example        # Environment variables template
```

## Code Conventions

- **Named exports only** — no default exports except `App.tsx` (Vite entry).
- **Feature hooks pattern**: each feature exposes a React hook (e.g. `useBinList`) for data via `apiFetch()` with event-based refresh, and plain async functions (e.g. `addBin`, `deleteBin`) for mutations. Data hooks use `useState` + `useEffect` + `apiFetch()` + custom DOM events (e.g. `bins-changed`) for cross-component refresh. Hooks live alongside plain functions in the same file.
- **Data hooks return `{ data, isLoading }`** — e.g. `useBinList()` returns `{ bins, isLoading }`, `useBin(id)` returns `{ bin, isLoading }`, `usePhotos(binId)` returns `{ photos, isLoading, refresh }`, `useLocationList()` returns `{ locations, isLoading, refresh }`, `useLocationMembers(locationId)` returns `{ members, isLoading }`.
- **`apiFetch<T>(path, options)`** in `lib/api.ts` — wraps fetch with JWT from localStorage, auto JSON stringify, FormData support. Throws `ApiError` on failure.
- **`useAuth()`** in `lib/auth.tsx` — provides `user`, `token`, `activeLocationId`, plus `login()`, `register()`, `logout()`, `setActiveLocationId()`, `updateUser()`, `deleteAccount(password)`.
- **Undo-delete pattern**: server returns deleted bin snapshot on DELETE, pass to `restoreBin(bin)` in the toast undo callback.
- **Snake_case field names** on DB-backed interfaces (`Bin`, `Photo`, `Location`, `LocationMember`, `Area`) to match PostgreSQL columns. Export types remain camelCase.
- **Areas**: `Area` interface `{ id, location_id, name, created_by, created_at, updated_at }`. Areas are named zones within a Location (e.g., "Garage", "Kitchen"). `Bin` has `area_id: string | null` (nullable — bins can be unassigned) and `area_name: string` (denormalized via LEFT JOIN). `useAreaList(locationId)` → `{ areas, isLoading }`. `createArea(locationId, name)`, `updateArea(locationId, areaId, name)`, `deleteArea(locationId, areaId)` for mutations. Area deletion sets bins' `area_id` to NULL. `AreaPicker` component provides dropdown with inline "Create new area..." option. `AreasPage` at `/areas` provides full CRUD: list with bin counts, inline rename, delete with confirmation, create dialog. Navigates to `/bins` with `{ state: { areaFilter: areaId } }` when an area is clicked.
- **`[key: string]: unknown` index signatures** on DB interfaces for type compatibility.
- **CSS**: use `var(--token)` design tokens, not raw colors. Glass effects via utility classes `glass-card`, `glass-nav`, `glass-heavy`.
- **Responsive**: mobile-first. Bottom nav on mobile (`lg:hidden`), sidebar on desktop (`hidden lg:flex`). Breakpoint is `lg` (1024px).
- **Lazy loading**: Dashboard, Scanner, Print, Settings, Auth, Profile, Tags, Items, and Areas pages are `React.lazy` with `<Suspense>`.
- **`cn()` helper** (clsx + tailwind-merge) for conditional class composition.
- **`addBin()` accepts an options object** (`AddBinOptions`): `{ name, locationId, items?, notes?, tags?, areaId?, icon?, color? }`. `locationId` is required. `short_code` is auto-generated by the server.
- **Short codes**: `Bin` has a `short_code` field — a 6-character alphanumeric code (charset excludes ambiguous chars like 0/O, 1/l) auto-generated on creation using `crypto.randomInt()`. Unique constraint in DB; server retries on collision. Used for manual bin lookup via `GET /api/bins/lookup/:shortCode`. `lookupBinByCode(code)` in `useBins.ts` wraps the API call. QR scanner page includes a manual lookup input.
- **Icon/color fields**: `icon` and `color` are strings on the `Bin` interface. Empty string `''` means default (Package icon, no color). Icon stores PascalCase lucide name (e.g. `'Wrench'`); color stores a preset key (e.g. `'blue'`).
- **`resolveIcon(name)`** in `lib/iconMap.ts` returns a LucideIcon, falling back to Package.
- **`getColorPreset(key)`** in `lib/colorPalette.ts` returns `{ bg, bgDark, dot }` for theme-aware tinting. `bg`/`bgDark` are used for BinCard backgrounds; `dot` is unused but retained in the palette.
- **Colored bin contrast**: BinCard overrides muted text/icon colors on colored bins via inline `style` — `rgba(255,255,255,0.7)` (dark) / `rgba(0,0,0,0.55)` (light) — because `--text-tertiary` (`#8e8e93`) is the same in both modes and has poor contrast against colored backgrounds. The `useTheme()` hook ensures correct recomputation on theme switch.
- **App settings**: `useAppSettings()` in `lib/appSettings.ts` manages app name/subtitle via `localStorage('sanduk-app-name')`.
- **User profile fields**: `User` interface includes `email: string | null` and `avatarUrl: string | null`. Avatars stored in `uploads/avatars/` with UUID filenames, served via `GET /api/auth/avatar/:userId`.
- **`updateUser(user)`** on auth context allows immediate UI updates after profile edits (avatar, display name, email) without re-fetching `/me`.
- **Input validation limits**: Bin name max 255 chars, items array max 500 entries, tags array max 50 entries, notes max 10000 chars. Enforced on both create and update endpoints.
- **Password policy**: Minimum 8 characters with at least one uppercase letter, one lowercase letter, and one digit. Enforced on registration and password change.
- **File upload extensions**: Derived from MIME type (not user-supplied filename) for both photos and avatars. MIME-to-extension mapping ensures safe file extensions.
- **Tag colors**: `TagColor` type with `{ tag, color, location_id }`. `useTagColorsContext()` from `TagColorsContext` provides a `Map<string, string>` mapping tag names to color preset keys. `setTagColor()` and `removeTagColor()` in `useTagColors.ts` for mutations. Colors use the same `colorPalette.ts` presets as bin colors.
- **TagInput dropdown**: On focus, shows all available (unselected) suggestions as pill-shaped badges with tag colors. Filters as user types. Dropdown stays open when selecting tags so users can pick multiple. Items render as rounded badges (matching the selected tag appearance) rather than a traditional list dropdown. Input refocuses automatically after tag selection. Selected tags show the remove (X) button to the left of the tag name.
- **BinCard tags**: Tags row is single-line (`overflow-hidden`, no wrapping) to keep cards compact on the list page.
- **useBins.ts exports**: hooks (`useBinList`, `useBin`, `useAllTags`), plain functions (`addBin`, `updateBin`, `deleteBin`, `restoreBin`, `lookupBinByCode`, `notifyBinsChanged`), types/constants (`SortOption`, `BinFilters`, `EMPTY_FILTERS`, `countActiveFilters`). `SortOption` includes `'area'` — sorts by area name then bin name, unassigned last.

## Server API Routes

- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/password`, `POST /api/auth/avatar`, `DELETE /api/auth/avatar`, `GET /api/auth/avatar/:userId`, `DELETE /api/auth/account`
- **Locations**: `GET /api/locations`, `POST /api/locations`, `PUT /api/locations/:id`, `DELETE /api/locations/:id`, `GET /api/locations/:id/members`, `POST /api/locations/join`, `DELETE /api/locations/:id/members/:userId`, `POST /api/locations/:id/regenerate-invite`
- **Areas**: `GET /api/locations/:locationId/areas`, `POST /api/locations/:locationId/areas`, `PUT /api/locations/:locationId/areas/:areaId`, `DELETE /api/locations/:locationId/areas/:areaId`
- **Bins**: `POST /api/bins`, `GET /api/bins`, `GET /api/bins/lookup/:shortCode`, `GET /api/bins/:id`, `PUT /api/bins/:id`, `DELETE /api/bins/:id`, `PUT /api/bins/:id/add-tags`, `POST /api/bins/:id/photos`
- **Photos**: `GET /api/photos?bin_id=X`, `GET /api/photos/:id/file`, `DELETE /api/photos/:id`
- **Tag Colors**: `GET /api/tag-colors?location_id=X`, `PUT /api/tag-colors`, `DELETE /api/tag-colors/:tag?location_id=X`
- **AI**: `GET /api/ai/settings`, `PUT /api/ai/settings`, `DELETE /api/ai/settings`, `POST /api/ai/analyze` (by photoId), `POST /api/ai/analyze-image` (raw file upload via FormData), `POST /api/ai/test`
- **Export/Import**: `GET /api/locations/:id/export`, `POST /api/locations/:id/import`, `POST /api/import/legacy`

## Security

- **JWT secret**: `JWT_SECRET` env var is required — server crashes on startup if unset (no fallback).
- **JWT lifetime**: Tokens expire after 7 days.
- **CORS**: Restricted to `CORS_ORIGIN` env var (defaults to `http://localhost:3000`). Only `GET`, `POST`, `PUT`, `DELETE` methods allowed.
- **Rate limiting** (`express-rate-limit`): Login 5/15min, register 3/hr, join 10/15min, AI endpoints 30/hr per IP.
- **JSON body limit**: Default 1mb; import routes explicitly allow 50mb.
- **Nginx security headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self)`.
- **Path traversal guards**: All file-serving endpoints (photos, avatars) validate that resolved paths stay within the storage directory.
- **UUID validation in Electric shapes**: All `locationId` and `binId` values interpolated into Electric SQL shape URLs are validated against a UUID regex before use.
- **Import validation**: Photo imports enforce 10MB size limit per photo, whitelist file extensions (`.jpg`, `.jpeg`, `.png`, `.webp`), generate new UUID filenames, and reject paths containing `..`.
- **Invite code entropy**: 128-bit (`crypto.randomBytes(16)`).
- **AI API key encryption**: Keys encrypted at rest with AES-256-GCM when `AI_ENCRYPTION_KEY` env var is set. Stored as `enc:iv:authTag:ciphertext` in DB. Graceful fallback to plaintext if env var is unset.
- **Avatar endpoint**: `GET /api/auth/avatar/:userId` requires authentication.
- **Docker**: Container runs as non-root `node` user. No fallback defaults for `POSTGRES_PASSWORD` or `JWT_SECRET` — env vars are required (`${VAR:?error}`).
- **Electric SQL**: `ELECTRIC_INSECURE` defaults to `false` (configurable via env var).

## Gotchas

- **No shadcn CLI** — do not run `npx shadcn` commands. All UI components are custom.
- **Theme**: stored in `localStorage('sanduk-theme')`, applied via `<html class="dark|light">` before first paint (inline script in `index.html`). The `useTheme()` hook in `lib/theme.ts` is the single source of truth at runtime.
- **ISO date strings**: API returns dates as ISO strings. All date fields on Bin/Photo/Location are `string`, not `Date`.
- **Export backward compatibility**: `ExportBinV2` has optional `location?`, `icon?`, `color?`, `shortCode?` fields. Export writes area name into the `location` string field. On import, non-empty `location` strings are looked up or created as Areas via `INSERT ... ON CONFLICT DO NOTHING`. Old backups import cleanly. Import also handles legacy `homeName` field (maps to `locationName`).
- **Print label formats**: `labelFormats.ts` defines `LabelFormat` configs (Avery 5160, 5163, 5167, generic 2"x1"). Selected format persisted in `localStorage('sanduk-label-format')`. Labels show bin name, location, short code, and optional color swatch (full-width bar above bin name, `print-color-adjust: exact` for printing). "Customize dimensions" toggle on any preset reveals editable dimension fields (width, height, columns, QR size, margins); overrides persisted in `localStorage('sanduk-label-custom')`. Select Bins and Label Format sections are collapsible with summary text when collapsed. Area filter chips in the bin selector let users quickly select all bins from a specific area for batch printing.
- **`html5-qrcode` is ~330KB gzipped** — always dynamic-import the scanner page; never import statically.
- **Photos served via API**: `getPhotoUrl(id)` returns `/api/photos/${id}/file?token=...` with JWT appended as query parameter. No Blob/ObjectURL management needed.
- **BrowserRouter** — path-based URLs (e.g. `/bin/:id`). QR scanner regex handles both old hash (`#/bin/`) and new path (`/bin/`) URLs.
- **PWA caching**: `vite-plugin-pwa` uses `generateSW` mode. After changing precached assets, users may need a refresh to get the new service worker.
- **Auth tokens**: JWT stored in `localStorage('sanduk-token')`, active location in `localStorage('sanduk-active-location')`. Tokens expire after 7 days.
- **Dashboard** (`/` route): `DashboardPage` shows total bins/items/areas stat cards, Quick Scan button, area breakdown (clickable chips navigating to filtered bins), recently scanned bins, and recently updated bins. Has a `+` button in the header to create bins directly (uses `BinCreateDialog`). `useDashboard()` hook provides stats, `areaStats`, and recent bin lists.
- **Profile page** (`/profile`) is not in `navItems` — accessed from the account card on Settings or the user info area in the Sidebar.
- **Onboarding**: `useOnboarding()` in `features/onboarding/useOnboarding.ts` manages guided setup for new users. State persisted in `localStorage('sanduk-onboarding-{userId}')`. `OnboardingOverlay` renders in `AppLayout` when `isOnboarding && locations.length === 0`. 2 steps: name location → create bin. Step 1 includes photo upload (held in client memory, uploaded after bin creation), inline AI provider configuration (collapsible, hidden when already configured), and AI-powered photo analysis via `POST /api/ai/analyze-image` that auto-fills bin name, items, and tags. Photo upload is non-blocking (bin creation succeeds even if upload fails). First successful scan triggers `ScanSuccessOverlay` with celebratory animation (tracked via `localStorage('sanduk-first-scan-done-{userId}')`). CSS animations defined in `index.css` (`onboarding-step-enter`, `scan-*` classes). Registration no longer auto-creates a default location — onboarding handles location creation.
- **AI button always visible**: The Sparkles (AI analyze) button is always shown when a photo is available, regardless of whether AI is configured. In **onboarding**, clicking it without AI configured auto-expands the inline AI setup section and shows a helper message. In **BinDetailPage**, clicking it without AI configured opens a guidance dialog explaining supported providers and linking to Settings. This ensures discoverability — users always see the AI capability and are guided to set it up on demand.
- **Account deletion**: `DELETE /api/auth/account` requires password confirmation. Deletes user, their avatar, and any locations where they are the sole member (cascading bins, photos, tag colors). Shared locations are preserved (membership row removed via CASCADE). `created_by` columns on bins/photos/locations use `ON DELETE SET NULL`. Client-side `deleteAccount(password)` on auth context cleans up user-specific localStorage keys and logs out.
- **DB foreign keys**: `bins.created_by`, `photos.created_by`, and `locations.created_by` are nullable with `ON DELETE SET NULL` referencing `users(id)` — allows user deletion without orphaning shared data.

## Verification

```sh
# Frontend
npx tsc --noEmit   # Zero type errors
npx vitest run     # All tests pass
npx vite build     # Successful production build

# Server
cd server && npx tsc --noEmit  # Zero type errors

# Docker stack
docker compose up -d
docker compose ps   # All 3 services healthy
```

## Testing

- **Vitest 4** with **happy-dom** environment (not jsdom — jsdom 27 has ESM/CJS incompatibility).
- Tests mock `apiFetch` from `@/lib/api` and `useAuth` from `@/lib/auth`.
- `@testing-library/jest-dom` for DOM matchers.
- Test files live in `__tests__/` directories next to their feature code.

## Docker Deployment

1. Copy `.env.example` to `.env` and set required values:
   - `POSTGRES_PASSWORD` — generate with `openssl rand -base64 32`
   - `JWT_SECRET` — generate with `openssl rand -base64 32`
   - `CORS_ORIGIN` — your frontend URL (default: `http://localhost`)
   - `AI_ENCRYPTION_KEY` (optional) — generate with `openssl rand -base64 32` to encrypt AI API keys at rest
   - `ELECTRIC_INSECURE` (optional) — set to `true` only for development
2. Build frontend: `npx vite build`
3. Start stack: `docker compose up -d`
4. API runs migrations automatically on startup. Container runs as non-root `node` user.
5. Access at `http://localhost`

**Note**: `POSTGRES_PASSWORD` and `JWT_SECRET` are required — docker compose will fail if they are unset.
