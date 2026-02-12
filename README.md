# Sanduk

> *The word sandik (or sandık) primarily refers to a chest or box originating from Ottoman Turkish, which adopted it from the Persian sonduq, and ultimately from the Arabic ṣandūq.*

Multi-user, local-first PWA for organizing physical storage bins with QR codes and real-time sync. Create an account, join a shared location, print QR labels, and scan them to instantly look up contents. Data syncs via ElectricSQL to PostgreSQL, while the client stays fast and offline-capable.

> **Work in Progress** — This project is under active development. Features may be incomplete, and breaking changes can occur.

## Features

### Current

- **Accounts + shared locations** — Register/login, create or join a location, and share bins with members
- **Real-time sync** — ElectricSQL keeps bins and photos in sync across devices
- **Bin management** — Create, edit, and delete bins with names, items, notes, tags, icons, and colors
- **QR code generation** — Unique QR code per bin for quick identification
- **QR scanning** — Camera-based scanner to look up bin contents instantly
- **Photo attachments** — Attach photos to bins for visual reference
- **Label printing** — Print Avery 5160-compatible label sheets with QR codes and bin names
- **Search and filter** — Search bins by name, items, or tags
- **Bulk operations** — Long-press to select multiple bins for batch delete or tagging
- **Export/Import** — JSON backup with photos for data portability
- **Offline-first PWA** — Installable and usable without a network; syncs when reconnected

### Planned

- Nested bins, sub-containers, and location information
- Barcode scanning support (UPC/EAN)
- QR-encoded sharing between devices
- Optional cloud sync controls
- Drag-and-drop bin reordering
- Custom label templates
- Accessibility audit and improvements

## Architecture

```
Client (React + @electric-sql/react)
  - Reads:  useShape() -> Express proxy -> Electric -> Postgres
  - Writes: fetch('/api/...') -> Express API -> Postgres
```

Docker Compose services: PostgreSQL, ElectricSQL, API (Express), and Nginx (serves the frontend + proxies API).

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | React 18 + TypeScript 5 (strict) |
| Build | Vite 5 |
| Styling | Tailwind CSS 4 with CSS custom properties |
| Data Sync | ElectricSQL (`@electric-sql/client`, `@electric-sql/react`) |
| Database | PostgreSQL 16 |
| Server | Express 4 (JWT auth) |
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

# Start backend services (Postgres + Electric + API)
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
2. **Create/join a location** — Invite or join members to share bins
3. **Create a bin** — Add name, items, tags, icon, and color
4. **Print labels** — Go to Print, select bins, and print Avery 5160-compatible label sheets
5. **Stick labels** — Attach printed QR labels to your physical storage containers
6. **Scan to find** — Open Scan, point your camera at a label to jump to that bin's details
7. **Attach photos** — Add photos for visual reference
8. **Backup data** — Settings > Export Backup to save a JSON file with all bins and photos

## License

MIT
