# Sanduk

> *The word sandik (or sandık) primarily refers to a chest or box originating from Ottoman Turkish, which adopted it from the Persian sonduq, and ultimately from the Arabic ṣandūq.*

Multi-user PWA for organizing physical storage bins with QR codes. Create an account, join a shared location, print QR labels, and scan them to instantly look up contents. Data persists in PostgreSQL via Express API. Installable and offline-capable.

> **Work in Progress** — This project is under active development. Features may be incomplete, and breaking changes can occur.

## Features

### Current

- **Accounts + shared locations** — Register/login, create or join a location, and share bins with members
- **Bin management** — Create, edit, and delete bins with names, items, notes, tags, icons, and colors
- **QR code generation** — Unique QR code per bin for quick identification
- **QR scanning** — Camera-based scanner to look up bin contents instantly
- **Photo attachments** — Attach photos to bins for visual reference
- **AI-powered photo analysis** — Analyze bin photos with OpenAI, Anthropic, or compatible providers to auto-fill name, items, and tags
- **Dashboard** — Stats overview with total bins/items, quick scan, recently scanned and updated bins
- **Items view** — Searchable cross-bin item index, sortable by name or bin
- **Tag color management** — Assign colors to tags per location
- **Label printing** — Print label sheets (Avery 5160/5163/5167 + generic 2"x1") with customizable dimensions
- **Search and filter** — Search bins by name, items, or tags; filter by tags, colors, and content
- **Bulk operations** — Long-press to select multiple bins for batch delete or tagging
- **Guided onboarding** — Step-by-step setup for new users (create location, create first bin)
- **User profiles** — Avatar, display name, email management
- **Export/Import** — JSON backup with photos for data portability
- **Offline-first PWA** — Installable and usable without a network

### Planned

- Nested bins and sub-containers
- Barcode scanning support (UPC/EAN)
- QR-encoded sharing between devices
- Optional cloud sync controls
- Drag-and-drop bin reordering
- Custom label templates
- Accessibility audit and improvements

## Architecture

```
Client (React + TypeScript)
  └── apiFetch() → Express API → Postgres
```

Docker Compose services: PostgreSQL, API (Express), and Nginx (serves the frontend + proxies API).

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | React 18 + TypeScript 5 (strict) |
| Build | Vite 5 |
| Styling | Tailwind CSS 4 with CSS custom properties |
| Database | PostgreSQL 16 |
| Server | Express 4 (JWT auth) |
| AI Integration | OpenAI, Anthropic, OpenAI-compatible (per-user config) |
| Routing | react-router-dom 6 (BrowserRouter) |
| QR Generation | qrcode |
| QR Scanning | html5-qrcode |
| PWA | vite-plugin-pwa |
| Icons | lucide-react |
| Testing | Vitest + Testing Library + happy-dom |

## Installation and Setup

**Prerequisites:** Node.js 18+, Docker

### Local development

```bash
# Clone the repository
git clone https://github.com/akifbayram/qrcode.git
cd qrcode

# Configure env
cp .env.example .env

# Start backend services (Postgres + API)
docker compose up -d

# Install frontend deps and start dev server
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for production

```bash
npm run build

docker compose up -d --build
```

Nginx serves the built frontend at `http://localhost` and proxies API requests to the Express server.

## Usage

1. **Create an account** — Register and log in
2. **Dashboard** — Landing page shows stats, quick scan, and recent bins
3. **Create/join a location** — Invite or join members to share bins
4. **Create a bin** — Add name, items, tags, icon, and color
5. **Attach photos** — Add photos for visual reference; use AI analysis to auto-fill details
6. **Print labels** — Go to Print, select bins, and print label sheets (multiple Avery formats)
7. **Stick labels** — Attach printed QR labels to your physical storage containers
8. **Scan to find** — Open Scan, point your camera at a label to jump to that bin's details
9. **Backup data** — Settings > Export Backup to save a JSON file with all bins and photos

## License

MIT
