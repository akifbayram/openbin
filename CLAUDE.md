# QR Bin Inventory

## Project Overview

Multi-user PWA for organizing physical storage bins with real-time sync. Users register accounts, create/join households ("homes"), and share bins with household members. Users create named bins, attach QR codes, scan them to look up contents, and print label sheets. Photos can be attached to bins for visual reference. Data synced via ElectricSQL from PostgreSQL. Export/import provides JSON backup. Designed with an iOS 26 Liquid Glass aesthetic for a native-app feel on mobile.

**Core flows**: Register/login -> Create/join a home -> Create bin -> Print QR label -> Stick on container -> Scan to find contents. Attach photos, search/filter by name/tag/content, bulk-select via long-press for batch operations.

## Architecture

```
Client (React + @electric-sql/react)
  ├── Reads:  useShape() → Express proxy → Electric → Postgres
  └── Writes: fetch('/api/...') → Express API → Postgres
```

**Docker Compose services**: `postgres` (16-alpine, wal_level=logical), `electric` (electricsql/electric), `api` (Express), `nginx` (serves frontend + proxies API)

## Stack

- **Runtime**: React 18 + TypeScript 5 (strict) + Vite 5
- **Styling**: Tailwind CSS 4 with CSS custom properties (iOS 26 Liquid Glass design system)
- **Data**: ElectricSQL (`@electric-sql/client`, `@electric-sql/react`) for real-time Postgres sync
- **Server**: Express 4, PostgreSQL 16, JWT auth (bcrypt + jsonwebtoken)
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
    auth/           # LoginPage, RegisterPage, AuthGuard
    bins/           # BinListPage, BinDetailPage, useBins, BinCard, TagInput, IconPicker, ColorPicker
    homes/          # HomesPage, HomeSelector, HomeMembersDialog, useHomes
    photos/         # PhotoGallery, PhotoLightbox, usePhotos, compressImage
    profile/        # ProfilePage (avatar, display name, email, password change)
    qrcode/         # QRScannerPage, QRCodeDisplay, Html5QrcodePlugin
    print/          # PrintPage, LabelSheet, LabelCell
    settings/       # SettingsPage, exportImport
    layout/         # AppLayout, Sidebar, BottomNav
  lib/              # Shared utilities (utils.ts, theme.ts, api.ts, auth.tsx, electric.ts, navItems.ts, constants.ts, iconMap.ts, colorPalette.ts, appSettings.ts)
  types.ts          # All shared interfaces
server/
  src/              # Express API server
    index.ts        # App entry, route mounting
    db.ts           # pg Pool singleton
    migrate.ts      # SQL migration runner
    middleware/      # auth.ts (JWT), homeAccess.ts (home membership)
    routes/         # auth, homes, bins, photos, shapes, export
  migrations/       # SQL migration files
  Dockerfile        # Multi-stage build
docker-compose.yml  # Postgres, Electric, API, nginx
nginx.conf          # Reverse proxy config
.env.example        # Environment variables template
```

## Code Conventions

- **Named exports only** — no default exports except `App.tsx` (Vite entry).
- **Feature hooks pattern**: each feature exposes a React hook (e.g. `useBinList`) for real-time data via `useShape()` and plain async functions (e.g. `addBin`, `deleteBin`) for mutations via `apiFetch()`. Hooks live alongside plain functions in the same file.
- **Data hooks return `{ data, isLoading }`** — e.g. `useBinList()` returns `{ bins, isLoading }`, `useBin(id)` returns `{ bin, isLoading }`.
- **`apiFetch<T>(path, options)`** in `lib/api.ts` — wraps fetch with JWT from localStorage, auto JSON stringify, FormData support. Throws `ApiError` on failure.
- **`useAuth()`** in `lib/auth.tsx` — provides `user`, `token`, `activeHomeId`, plus `login()`, `register()`, `logout()`, `setActiveHomeId()`, `updateUser()`.
- **Undo-delete pattern**: server returns deleted bin snapshot on DELETE, pass to `restoreBin(bin)` in the toast undo callback.
- **Snake_case field names** on DB-backed interfaces (`Bin`, `Photo`, `Home`, `HomeMember`) to match PostgreSQL columns from ElectricSQL. Export types remain camelCase.
- **`[key: string]: unknown` index signatures** on DB interfaces for ElectricSQL `Row` type compatibility.
- **CSS**: use `var(--token)` design tokens, not raw colors. Glass effects via utility classes `glass-card`, `glass-nav`, `glass-heavy`.
- **Responsive**: mobile-first. Bottom nav on mobile (`lg:hidden`), sidebar on desktop (`hidden lg:flex`). Breakpoint is `lg` (1024px).
- **Lazy loading**: Scanner, Print, Settings, Auth, Homes, and Profile pages are `React.lazy` with `<Suspense>`.
- **`cn()` helper** (clsx + tailwind-merge) for conditional class composition.
- **`addBin()` accepts an options object** (`AddBinOptions`): `{ name, homeId, items?, notes?, tags?, location?, icon?, color? }`. `homeId` is required.
- **Icon/color fields**: `icon` and `color` are strings on the `Bin` interface. Empty string `''` means default (Package icon, no color). Icon stores PascalCase lucide name (e.g. `'Wrench'`); color stores a preset key (e.g. `'blue'`).
- **`resolveIcon(name)`** in `lib/iconMap.ts` returns a LucideIcon, falling back to Package.
- **`getColorPreset(key)`** in `lib/colorPalette.ts` returns `{ bg, bgDark, dot }` for theme-aware tinting. `bg`/`bgDark` are used for BinCard backgrounds; `dot` is unused but retained in the palette.
- **Colored bin contrast**: BinCard overrides muted text/icon colors on colored bins via inline `style` — `rgba(255,255,255,0.7)` (dark) / `rgba(0,0,0,0.55)` (light) — because `--text-tertiary` (`#8e8e93`) is the same in both modes and has poor contrast against colored backgrounds. The `useTheme()` hook ensures correct recomputation on theme switch.
- **App settings**: `useAppSettings()` in `lib/appSettings.ts` manages app name/subtitle via `localStorage('qrbin-app-name')`.
- **User profile fields**: `User` interface includes `email: string | null` and `avatarUrl: string | null`. Avatars stored in `uploads/avatars/` with UUID filenames, served via `GET /api/auth/avatar/:userId`.
- **`updateUser(user)`** on auth context allows immediate UI updates after profile edits (avatar, display name, email) without re-fetching `/me`.

## Server API Routes

- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/password`, `POST /api/auth/avatar`, `DELETE /api/auth/avatar`, `GET /api/auth/avatar/:userId`
- **Homes**: `GET /api/homes`, `POST /api/homes`, `PUT /api/homes/:id`, `DELETE /api/homes/:id`, `POST /api/homes/join`, `DELETE /api/homes/:id/members/:userId`, `POST /api/homes/:id/regenerate-invite`
- **Bins**: `POST /api/bins`, `GET /api/bins/:id`, `PUT /api/bins/:id`, `DELETE /api/bins/:id`, `PUT /api/bins/:id/add-tags`, `POST /api/bins/:id/photos`
- **Photos**: `GET /api/photos/:id/file`, `DELETE /api/photos/:id`
- **Shapes** (Electric proxy): `GET /api/shapes/bins?home_id=X`, `GET /api/shapes/photos?home_id=X`, `GET /api/shapes/homes`, `GET /api/shapes/home-members?home_id=X`
- **Export/Import**: `GET /api/homes/:id/export`, `POST /api/homes/:id/import`, `POST /api/import/legacy`

## Gotchas

- **No shadcn CLI** — do not run `npx shadcn` commands. All UI components are custom.
- **Theme**: stored in `localStorage('qrbin-theme')`, applied via `<html class="dark|light">` before first paint (inline script in `index.html`). The `useTheme()` hook in `lib/theme.ts` is the single source of truth at runtime.
- **ISO date strings**: ElectricSQL returns dates as ISO strings. All date fields on Bin/Photo/Home are `string`, not `Date`.
- **Export backward compatibility**: `ExportBinV2` has optional `icon?`, `color?` fields. Import defaults missing fields to `''`. Old backups without these fields import cleanly.
- **`html5-qrcode` is ~330KB gzipped** — always dynamic-import the scanner page; never import statically.
- **Photos served via API**: `getPhotoUrl(id)` returns `/api/photos/${id}/file`. No Blob/ObjectURL management needed.
- **BrowserRouter** — path-based URLs (e.g. `/bin/:id`). QR scanner regex handles both old hash (`#/bin/`) and new path (`/bin/`) URLs.
- **PWA caching**: `vite-plugin-pwa` uses `generateSW` mode. After changing precached assets, users may need a refresh to get the new service worker.
- **Auth tokens**: JWT stored in `localStorage('qrbin-token')`, active home in `localStorage('qrbin-active-home')`.
- **Profile page** (`/profile`) is not in `navItems` — accessed from the account card on Settings or the user info area in the Sidebar.

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
docker compose ps   # All 4 services healthy
```

## Testing

- **Vitest 4** with **happy-dom** environment (not jsdom — jsdom 27 has ESM/CJS incompatibility).
- Tests mock `apiFetch` from `@/lib/api` and `useAuth` from `@/lib/auth`.
- `@testing-library/jest-dom` for DOM matchers.
- Test files live in `__tests__/` directories next to their feature code.

## Docker Deployment

1. Copy `.env.example` to `.env` and set secure values for `POSTGRES_PASSWORD` and `JWT_SECRET`
2. Build frontend: `npx vite build`
3. Start stack: `docker compose up -d`
4. API runs migrations automatically on startup
5. Access at `http://localhost`
