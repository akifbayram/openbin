# OpenBin Documentation Site — Design Document

**Date:** 2026-02-28
**Status:** Approved

---

## Overview

A VitePress-based documentation site for OpenBin, living inside the existing repo under `/docs/`, deployed to GitHub Pages via GitHub Actions.

Reference examples: [paperless-ngx docs](https://docs.paperless-ngx.com/), [scrypted docs](https://docs.scrypted.app/)

---

## Architecture & Tooling

| Decision | Choice |
|---|---|
| Framework | VitePress (latest stable) |
| Location | `/docs/` inside the existing repo |
| Deploy target | GitHub Pages (`https://akifbayram.github.io/openbin`) |
| Domain | Default GitHub Pages URL (custom domain later) |
| Search | VitePress built-in local search |
| Theme | VitePress default theme + OpenBin brand colors |
| CI | GitHub Actions → `gh-pages` branch |

---

## Content Structure

```
docs/
├── index.md                    # Homepage (hero, feature grid, CTAs)
├── getting-started/
│   ├── index.md                # Overview & prerequisites
│   ├── docker.md               # Docker Compose quick start
│   ├── local-dev.md            # Node.js dev setup
│   └── configuration.md       # All env vars reference table
├── guide/
│   ├── index.md                # User guide overview
│   ├── locations.md            # Locations, areas, invite codes
│   ├── bins.md                 # Creating, editing, card styles, visibility
│   ├── qr-scanning.md          # QR scanner, short code lookup
│   ├── print-labels.md         # Print page, label formats, PDF export
│   ├── ai.md                   # AI setup, photo analysis, commands, search
│   ├── search-filter.md        # Search, filters, saved views
│   ├── bulk-operations.md      # Multi-select, bulk tag/move/delete
│   ├── photos.md               # Photo attachments, thumbnails
│   ├── import-export.md        # JSON/ZIP/CSV import & export
│   ├── dashboard.md            # Stats, pins, recent scans, queue
│   └── api-keys.md             # Long-lived tokens for automation
├── api/
│   ├── index.md                # API overview, auth, base URL, envelopes
│   └── reference.md            # Generated from server/openapi.yaml
└── .vitepress/
    ├── config.ts               # Nav, sidebar, theme config
    └── theme/
        └── index.ts            # Custom theme (brand colors, overrides)
```

---

## Agent Responsibilities (Option A — By Content Pillar)

| Agent | Role | Deliverables |
|---|---|---|
| **PM** | Project manager + scaffolder | VitePress install & config, `docs/.vitepress/config.ts`, homepage (`index.md`), GitHub Actions workflow, brand theme |
| **Agent 1** | Getting Started & Configuration | All pages under `getting-started/` — prerequisites, Docker, local dev, full env var table from `.env.example` |
| **Agent 2** | User Guide | All 12 pages under `guide/` covering every app feature |
| **Agent 3** | API Reference | `api/index.md` + `api/reference.md` parsed from `server/openapi.yaml` |
| **Agent 4** | Site polish | Cross-page consistency, broken links, callout blocks, homepage polish, final sidebar ordering |

### Coordination flow

1. PM scaffolds VitePress skeleton + config first
2. Agents 1, 2, 3 run in parallel writing content
3. Agent 4 runs last, reviewing and polishing

---

## GitHub Actions Workflow

```yaml
# .github/workflows/docs.yml
on:
  push:
    branches: [main]
    paths: ['docs/**']

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: docs
      - run: npm run build
        working-directory: docs
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/.vitepress/dist
```

Triggers only on changes to `docs/**`. Uses `GITHUB_TOKEN` — no extra secrets required.

---

## Theme & Homepage

**Homepage hero:**
- Tagline: *"Self-hosted bin inventory with QR codes and AI"*
- CTAs: `Get Started →` and `View on GitHub`
- Feature grid (6 tiles): QR Scanning, AI Photo Analysis, Print Labels, Multi-user, Search & Filter, API Access

**Brand colors:**
- Primary accent: blue-teal range (`#3b82f6` → `#06b6d4`)
- Dark mode as default, light mode toggle
- Code blocks match the app's dark surface aesthetic

**v1 constraints (YAGNI):**
- No custom Vue components — use VitePress built-in containers only
- Screenshot images are placeholders (`./img/placeholder.png`)
- No versioning or i18n in v1
- No Algolia search — local search only
