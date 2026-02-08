# QR Bin Inventory

## Project Overview

Offline-first PWA for organizing physical storage bins. Users create named bins, attach QR codes, scan them to look up contents, and print label sheets. Photos can be attached to bins for visual reference. All data lives in IndexedDB — no server, no accounts. Export/import provides JSON backup with base64-encoded photos. Designed with an iOS 26 Liquid Glass aesthetic for a native-app feel on mobile.

**Core flows**: Create bin -> Print QR label -> Stick on container -> Scan to find contents. Attach photos, search/filter by name/tag/content, bulk-select via long-press for batch operations.

## Stack

- **Runtime**: React 18 + TypeScript 5 (strict) + Vite 5
- **Styling**: Tailwind CSS 4 with CSS custom properties (iOS 26 Liquid Glass design system)
- **Data**: Dexie.js 4 (IndexedDB), schema version 2 — tables: `bins`, `photos`
- **Routing**: react-router-dom 6 (HashRouter), lazy-loaded routes
- **QR**: `qrcode` (generation), `html5-qrcode` (scanning)
- **PWA**: vite-plugin-pwa
- **Icons**: lucide-react
- **No component library** — all UI primitives hand-rolled in `src/components/ui/`

## Project Structure

```
src/
  components/ui/    # Reusable primitives (button, card, dialog, input, toast, etc.)
  features/         # Feature modules — each owns its pages, hooks, and helpers
    bins/           # BinListPage, BinDetailPage, useBins, BinCard, TagInput
    photos/         # PhotoGallery, PhotoLightbox, usePhotos, compressImage
    qrcode/         # QRScannerPage, QRCodeDisplay, Html5QrcodePlugin
    print/          # PrintPage, LabelSheet, LabelCell
    settings/       # SettingsPage, exportImport
    layout/         # AppLayout, Sidebar, BottomNav
  lib/              # Shared utilities (utils.ts, theme.ts, navItems.ts, constants.ts)
  db/index.ts       # Dexie singleton
  types.ts          # All shared interfaces
```

## Code Conventions

- **Named exports only** — no default exports except `App.tsx` (Vite entry).
- **Feature hooks pattern**: each feature exposes a React hook (e.g. `useBinList`) for live queries and plain async functions (e.g. `addBin`, `deleteBin`) for mutations. Hooks live alongside plain functions in the same file.
- **Transactions for multi-table writes** — always wrap cross-table mutations in `db.transaction('rw', [...tables])`.
- **Undo-delete pattern**: snapshot the record (and related photos) _before_ deleting, pass snapshot to `restoreBin(bin, photos?)` in the toast undo callback.
- **CSS**: use `var(--token)` design tokens, not raw colors. Glass effects via utility classes `glass-card`, `glass-nav`, `glass-heavy`.
- **Responsive**: mobile-first. Bottom nav on mobile (`lg:hidden`), sidebar on desktop (`hidden lg:flex`). Breakpoint is `lg` (1024px).
- **Lazy loading**: Scanner, Print, and Settings pages are `React.lazy` with `<Suspense>`.
- **`cn()` helper** (clsx + tailwind-merge) for conditional class composition.

## Gotchas

- **No shadcn CLI** — do not run `npx shadcn` commands. All UI components are custom.
- **Theme**: stored in `localStorage('qrbin-theme')`, applied via `<html class="dark|light">` before first paint (inline script in `index.html`). The `useTheme()` hook in `lib/theme.ts` is the single source of truth at runtime.
- **Dexie dates**: IndexedDB stores `Date` objects natively. Export serializes to ISO strings; import deserializes back.
- **`html5-qrcode` is ~330KB gzipped** — always dynamic-import the scanner page; never import statically.
- **Photo blobs**: stored as raw `Blob` in IndexedDB. Object URLs must be revoked on cleanup. Export converts to base64.
- **HashRouter** — all internal links use `#/path` format. `useNavigate` handles this transparently.
- **PWA caching**: `vite-plugin-pwa` uses `generateSW` mode. After changing precached assets, users may need a refresh to get the new service worker.

## Verification

```sh
npx tsc --noEmit   # Zero type errors
npx vite build     # Successful production build
```

## Agent Team Plan (3 Parallel Agents)

For large features, split into three domain-aligned agents. Use Slack (`#qrbin-dev`) for cross-agent coordination.

| Agent | Name | Role | Owns |
|-------|------|------|------|
| 1 | **data-layer** | DB, hooks, pure logic | `src/db/`, `src/types.ts`, `src/features/*/use*.ts`, `src/features/settings/exportImport.ts` |
| 2 | **ui-components** | Pages, components, styling | `src/features/*/Page.tsx`, `src/features/*/*.tsx` (non-hook), `src/components/ui/` |
| 3 | **infra-nav** | Routing, layout, build, PWA | `src/App.tsx`, `src/features/layout/`, `src/lib/`, `vite.config.ts`, `index.html` |

### Workflow

1. **data-layer** starts first — types and DB schema must land before UI can import them.
2. **ui-components** and **infra-nav** run in parallel once types exist.
3. Each agent posts to Slack on completion: `data-layer done: types + hooks merged`.
4. **infra-nav** runs final `tsc --noEmit && vite build` and posts result to Slack.
5. Any agent blocked by another posts to Slack with `BLOCKED: need X from @agent-name`.

### Slack Integration

- Channel: `#qrbin-dev`
- Post on: task start, completion, blockers, build results
- Use `SendMessage` for direct agent-to-agent coordination; Slack for team-wide visibility
