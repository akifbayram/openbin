---
layout: home

hero:
  name: "OpenBin"
  text: "Self-hosted bin inventory"
  tagline: Organize physical storage bins with QR codes and AI. Print labels, scan to find, ask where things are.
  actions:
    - theme: brand
      text: Get Started →
      link: /getting-started/
    - theme: alt
      text: View on GitHub
      link: https://github.com/akifbayram/openbin
    - theme: alt
      text: Live Demo
      link: https://demo.openbin.app
    - theme: alt
      text: Discord
      link: https://discord.gg/W6JPZCqqx9

features:
  - icon: 🤖
    title: AI Photo Analysis
    details: Capture a photo in-app or from your gallery and AI names the bin, lists every item with quantities, suggests tags, and adds notes.
    link: /guide/ai
    linkText: Learn more
  - icon: 📦
    title: QR Scanning
    details: Scan any bin's QR label with your phone camera to instantly see its contents.
    link: /guide/qr-scanning
    linkText: Learn more
  - icon: 🖨️
    title: Print Labels
    details: Generate and print QR label sheets or name cards with customizable formats, sizes, and styles.
    link: /guide/print-labels
    linkText: Learn more
  - icon: 👥
    title: Multi-user
    details: Share locations with invite codes. Role-based access with nested, hierarchical areas.
    link: /guide/locations
    linkText: Learn more
  - icon: 🔌
    title: REST API
    details: Long-lived API keys for headless access and automation. Full OpenAPI spec included.
    link: /api/
    linkText: API docs
  - icon: 🔗
    title: MCP Server
    details: Connect Claude and other AI assistants directly to your inventory via Model Context Protocol.
    link: /guide/mcp-server
    linkText: Learn more
---

## Features

<div class="home-features">

### Organize

- Create bins with names, items (with quantities), notes, and tags
- Group bins into hierarchical areas and sub-areas within locations
- Color-code bins with icons and card styles (gradient, stripe, border, photo cover)
- Pin frequently used bins to your dashboard
- Save search views and reuse them with one click
- Bulk operations: tag, move, change appearance, or delete multiple bins at once
- Soft-delete with trash and restore

### AI & Automation

- Photo analysis: snap a photo and AI names the bin, lists items with quantities, suggests tags and notes
- Natural language commands: "Add batteries to the tools bin" or "Create a bin with screws, bolts, and washers"
- AI reorganization: suggest how to restructure an entire location's bins, areas, and tags
- Bring your own AI: supports OpenAI, Anthropic, Gemini, and any OpenAI-compatible endpoint
- Per-user AI settings with encrypted API key storage

### QR Labels & Scanning

- Generate customizable QR label sheets with multiple formats and sizes
- Style QR codes with custom dot/corner patterns and colors
- Print name-card labels or item-list sheets
- Scan any label with your phone camera to see what's inside
- Works with both the built-in scanner and any standard QR reader

### Multi-user & Access Control

- Share locations via invite codes
- Three roles: admin, member (read-write), viewer (read-only)
- Configurable default join role per location
- Private bins visible only to their creator
- Full activity log of every change

### Data & Integration

- Full JSON/CSV/ZIP export with photos
- Import from backup to restore or migrate
- REST API with long-lived API keys for automation
- MCP server: connect Claude and other AI assistants directly to your inventory
- Single SQLite file — no external database, easy to back up
- Scheduled automatic backups with webhook notifications

</div>