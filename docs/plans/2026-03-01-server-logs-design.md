# Server Logs Feature — Design Document

**Date:** 2026-03-01
**Status:** Approved

## Summary

Add a live server log viewer to OpenBin's web UI, allowing admins to monitor HTTP requests and application errors in real-time — like a built-in `docker logs -f`.

## Requirements

- **Content:** Structured HTTP request logs (method, path, status, duration, IP) + application errors/warnings
- **Access:** Admin-only (user must be admin of at least one location)
- **Persistence:** In-memory ring buffer (last 1,000 entries). Logs reset on server restart.
- **Delivery:** Live tail via Server-Sent Events (SSE)

## Architecture

### Server-Side

#### 1. Ring Buffer (`server/src/lib/logBuffer.ts`)

Circular buffer holding the last 1,000 log entries in memory.

```typescript
interface LogEntry {
  id: number;          // Auto-incrementing sequence
  timestamp: string;   // ISO 8601
  level: 'info' | 'warn' | 'error';
  method?: string;     // HTTP method
  path?: string;       // Request path
  status?: number;     // HTTP status code
  duration?: number;   // Response time in ms
  ip?: string;         // Client IP
  message?: string;    // Free-form message (errors, startup)
}
```

Exposes:
- `pushLog(entry)` — Adds entry to buffer, notifies all SSE subscribers
- `getEntries(sinceId?: number)` — Returns entries after a given ID (for initial load + catchup)
- `subscribe(callback)` / `unsubscribe(callback)` — Pub/sub for SSE connections

#### 2. Request Logger Middleware (`server/src/middleware/requestLogger.ts`)

Express middleware placed early in the stack (after compression, before routes). On `res.finish`, pushes a structured log entry with method, path, status, duration, and IP.

Also captures:
- Global error handler errors → `level: 'error'`
- Server startup message → `level: 'info'`

#### 3. Routes (`server/src/routes/logs.ts`)

Two admin-only endpoints:

- **`GET /api/admin/logs`** — Returns current buffer as `{ results: LogEntry[], count }`. Supports `?since=<id>` query param.
- **`GET /api/admin/logs/stream`** — SSE endpoint. Authenticates via JWT cookie. Pushes each new log entry as `data: JSON\n\n`. Keepalive comment every 30s.

Auth: `authenticate` middleware + check that user is admin of any location.

### Frontend

#### 4. Feature Module (`src/features/logs/`)

- **`LogsPage.tsx`** — Terminal-style log viewer. Dark panel, monospace text. Auto-scroll to bottom. Color-coded entries (green=2xx, yellow=4xx, red=5xx). Filter by level. Pause/resume button.
- **`useLogStream.ts`** — Hook that fetches initial entries via REST, then opens `EventSource` for live updates. Caps client-side entries at ~1,000.

#### 5. Navigation

- Route: `/logs`, admin-guarded
- Link in Settings page (admin section) and optionally sidebar

### Wire-Up

- Mount `logsRouter` at `/api/admin/logs` in `server/src/index.ts`
- Add request logger middleware early in Express stack
- Disable compression for SSE endpoint (compression buffers chunks, breaking streaming)

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transport | SSE (not WebSocket) | Unidirectional, works through reverse proxies, no new deps |
| Storage | In-memory ring buffer | No disk/DB overhead, acceptable for self-hosted admin tool |
| Buffer size | 1,000 entries | Enough for debugging without significant memory use |
| Auth scope | Admin of any location | Instance-level feature, not location-scoped |
| Logging library | None (custom middleware) | Fits project convention of no external deps for core features |

## Non-Goals

- Log file persistence / rotation
- Log search or full-text indexing
- Real-time activity feed (separate feature)
- Log forwarding to external services
