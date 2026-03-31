# PostgreSQL Dual-Database Support

**Date**: 2026-03-31
**Status**: Draft
**Approach**: Dialect abstraction in `db.ts` (Approach A)

## Motivation

1. **Scalability** — SQLite's single-writer limitation constrains high-concurrency deployments.
2. **Hosting flexibility** — support managed PostgreSQL services (RDS, Supabase, Neon, etc.) for users who prefer them.

The database engine is chosen at initial setup and cannot be changed afterward.

## Decision Summary

| Decision | Choice |
|---|---|
| Engine detection | `DATABASE_URL` env var → PostgreSQL; else SQLite via `DATABASE_PATH` |
| PostgreSQL client | `pg` (node-postgres) — matches existing `QueryResult<T>` shape |
| Fuzzy search (PG) | `pg_trgm` extension with `similarity()` |
| Tag storage (PG) | `jsonb` column (same model as SQLite's JSON TEXT) |
| Architecture | Dialect abstraction in `db.ts` — thin facade over engine-specific implementations |

## 1. Engine Detection & Initialization

### Detection Rule

- `DATABASE_URL` is set and starts with `postgres://` or `postgresql://` → PostgreSQL mode
- Otherwise → SQLite mode using `DATABASE_PATH` (default `./data/openbin.db`)

### Lock-In Enforcement

On first startup, the engine writes a row to the `settings` table: `{key: 'db_engine', value: 'sqlite' | 'postgres'}`. On subsequent startups, if the env var disagrees with the stored marker, the server refuses to start with a clear error.

### File Structure

```
server/src/
  db.ts                  # Thin facade — re-exports from active engine
  db/
    types.ts             # QueryResult<T>, DatabaseEngine interface, TxQueryFn
    sqlite.ts            # SQLite engine (better-sqlite3)
    postgres.ts          # PostgreSQL engine (pg Pool)
    dialect.ts           # SQL fragment helpers per engine
    init.ts              # detectEngine(), initialize(), schema loading
```

### DatabaseEngine Interface

```ts
interface DatabaseEngine {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  querySync<T>(sql: string, params?: unknown[]): QueryResult<T>;  // throws in PG mode
  withTransaction<T>(fn: (tx: { query<R>(sql: string, params?: unknown[]): Promise<QueryResult<R>> }) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly dialect: 'sqlite' | 'postgres';
}

interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}
```

### Facade Exports (`db.ts`)

The facade re-exports from the active engine, preserving existing call signatures:

- `query<T>(sql, params?)` — async, works on both engines
- `querySync<T>(sql, params?)` — SQLite only; throws in PG mode
- `withTransaction<T>(fn)` — new, replaces direct `getDb().transaction()` usage
- `generateUuid()` — unchanged (`crypto.randomUUID()`)
- `getDialect()` — returns `'sqlite' | 'postgres'`
- `getDb()` — SQLite only; throws in PG mode (forces migration of callsites)

## 2. SQL Dialect Differences

A `dialect.ts` module provides fragment builders for the ~6 syntax differences. Queries that use only standard SQL with `$N` placeholders (the majority) need zero changes.

### Dialect Map

| Concept | SQLite | PostgreSQL |
|---|---|---|
| Current timestamp | `datetime('now')` | `NOW()` |
| Current date | `date('now')` | `CURRENT_DATE` |
| Date arithmetic | `datetime('now', '+N seconds')` | `NOW() + make_interval(secs => N)` |
| Date extraction | `date(sent_at)` | `sent_at::date` |
| Case-insensitive sort | `COLLATE NOCASE` | use `LOWER()` |
| Auto-increment PK | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| JSON array iterate | `json_each(col)` | `jsonb_array_elements_text(col)` |
| JSON array aggregate | `json_group_array(expr)` | `json_agg(expr)` |
| JSON object aggregate | `json_group_object(k, v)` | `json_object_agg(k, v)` |
| Fuzzy search | `fuzzy_match(text, term) = 1` | `similarity(text, term) > 0.3` |
| Boolean literals | `0` / `1` | `FALSE` / `TRUE` |

### Implementation

```ts
// dialect.ts — fragment builders
export const d = {
  now:       () => engine === 'sqlite' ? "datetime('now')" : 'NOW()',
  today:     () => engine === 'sqlite' ? "date('now')" : 'CURRENT_DATE',
  dateOf:    (col: string) => engine === 'sqlite' ? `date(${col})` : `${col}::date`,
  intervalSeconds: (param: string) =>
    engine === 'sqlite'
      ? `datetime('now', '+' || ${param} || ' seconds')`
      : `NOW() + make_interval(secs => ${param})`,
  fuzzyMatch: (col: string, param: string) =>
    engine === 'sqlite'
      ? `fuzzy_match(${col}, ${param}) = 1`
      : `similarity(${col}, ${param}) > 0.3`,
  jsonEach: (col: string) =>
    engine === 'sqlite'
      ? `json_each(${col})`
      : `jsonb_array_elements_text(${col})`,
  jsonGroupArray: (expr: string) =>
    engine === 'sqlite'
      ? `json_group_array(${expr})`
      : `json_agg(${expr})`,
  jsonGroupObject: (key: string, value: string) =>
    engine === 'sqlite'
      ? `json_group_object(${key}, ${value})`
      : `json_object_agg(${key}, ${value})`,
  nocase: () => engine === 'sqlite' ? 'COLLATE NOCASE' : '',
};
```

## 3. Transaction Abstraction & `getDb()` Migration

### `withTransaction()`

```ts
async function withTransaction<T>(
  fn: (tx: { query<R>(sql: string, params?: unknown[]): Promise<QueryResult<R>> }) => Promise<T>
): Promise<T>
```

- **SQLite**: Wraps `better-sqlite3`'s `.transaction()` internally. The callback's `tx.query()` runs synchronously but returns a Promise for API consistency.
- **PostgreSQL**: Acquires a client from the pool, runs `BEGIN`, passes `tx.query()` bound to that client, then `COMMIT` or `ROLLBACK`.

### Migration of `getDb()` Callsites (~26 files)

| Pattern | Count | Migration |
|---|---|---|
| `.transaction()` blocks (bins, locations, exports, pins, custom fields, user cleanup) | ~12 | Rewrite to `withTransaction()` |
| `.prepare().run/get/all()` one-liners (admin, jobLock, requireAdmin) | ~10 | Replace with `query()` calls |
| `db.backup()` (backup.ts) | 1 | Branch on dialect: SQLite `db.backup()` / PG `pg_dump` |
| `db.function()` for fuzzy_match (db.ts init) | 1 | SQLite-only init; PG uses `pg_trgm` |
| `sqlite_master` introspection (db.ts migrations) | 2 | SQLite-only init; PG uses `information_schema` |

### `querySync()` Handling

Kept for SQLite mode only. In PostgreSQL mode, calling `querySync()` throws with a clear error. Files currently using it (`exportHelpers.ts`, `photoCleanup.ts`, `activityLog.ts`, `queryHelpers.ts`) get migrated to async. The import transaction code (largest sync user) gets rewritten to use `withTransaction()`.

After migration, `getDb()` is only called in `db/sqlite.ts` internals and tests — routes never touch it.

## 4. Schema

### Two Schema Files

- `server/schema.sqlite.sql` — renamed from current `schema.sql`, unchanged
- `server/schema.pg.sql` — PostgreSQL adaptation

### PostgreSQL Schema Differences

| SQLite | PostgreSQL |
|---|---|
| `TEXT` for JSON columns | `JSONB` |
| `INTEGER` booleans (`is_admin`, `is_active`) | `BOOLEAN` with `DEFAULT FALSE` |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `datetime('now')` defaults | `NOW()` |
| `date('now')` defaults | `CURRENT_DATE` |

Everything else (TEXT PRIMARY KEY, CHECK constraints, CREATE INDEX IF NOT EXISTS, foreign keys, UNIQUE constraints) works identically.

### Migrations

- **SQLite**: Unchanged — `ALTER TABLE ADD COLUMN` with try/catch for idempotency. `sqlite_master` introspection for table rebuilds.
- **PostgreSQL**: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (PG supports this natively). `information_schema.columns` for introspection. `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` for constraint changes (no table rebuilds needed).
- Both engines: init code in `db/init.ts` branches on dialect for engine-specific migration logic.

### PostgreSQL-Specific Init

- `CREATE EXTENSION IF NOT EXISTS pg_trgm` at startup
- No custom function registration (unlike SQLite's `fuzzy_match`)

## 5. Backup

- **SQLite mode**: Unchanged — `db.backup()` snapshots the `.db` file into a ZIP with photos.
- **PostgreSQL mode**: Uses `pg_dump` via `execFile()` (not `exec()`, to avoid shell injection) to dump to a SQL file, then archives into the same ZIP format with photos. Requires `pg_dump` binary in the Docker image.
- `runBackup()` branches internally based on `getDialect()`. Same external API, same ZIP output shape.

## 6. Docker & Config

### Docker

- Single image, no variants.
- Dockerfile adds `postgresql-client` package (for `pg_dump`) alongside existing `python3/make/g++` (for `better-sqlite3`). Adds ~15MB.
- Existing `docker-compose.yml` stays SQLite-only by default.
- New `docker-compose.pg.yml` override example showing PostgreSQL service + `DATABASE_URL`.

### Config (`config.ts`)

New fields:

```ts
databaseUrl: process.env.DATABASE_URL || null,
dbEngine: process.env.DATABASE_URL ? 'postgres' : 'sqlite',  // derived, read-only
```

Existing `databasePath` stays for SQLite mode.

### `.env.example`

```
# Database engine (choose one):
# DATABASE_URL=postgres://user:pass@host:5432/openbin  # PostgreSQL
# DATABASE_PATH=./data/openbin.db                      # SQLite (default)
```

### Dependencies (`server/package.json`)

- Add `pg` as a regular dependency
- Add `@types/pg` as a dev dependency
- `better-sqlite3` stays as-is

## 7. Testing

### Dual-Engine Test Runs

Tests run against both engines. Test setup checks `DATABASE_URL` to determine engine, same as production.

- **Default (CI and local)**: SQLite — fast, no external dependencies.
- **PostgreSQL CI job**: Separate GitHub Actions matrix entry runs the same test suite against a PostgreSQL container (`services: postgres`).
- **No separate test files per engine** — same tests exercise both paths.

### Engine-Specific Assertions

Fuzzy search result ordering may differ between Levenshtein (SQLite) and trigram similarity (PG). Tests use containment assertions ("results contain X") rather than exact ordering.

### Test Additions

- `server/src/db/__tests__/dialect.test.ts` — unit tests for dialect fragment builders (pure functions, no DB)
- Existing integration tests naturally cover both engines when run with PG env var
- Backup test: mocked per-engine (SQLite mocks `db.backup()`, PG mocks `pg_dump`)

## Files Changed (Estimated)

### New Files (~8)
- `server/src/db/types.ts`
- `server/src/db/sqlite.ts`
- `server/src/db/postgres.ts`
- `server/src/db/dialect.ts`
- `server/src/db/init.ts`
- `server/schema.pg.sql`
- `docker-compose.pg.yml`
- `server/src/db/__tests__/dialect.test.ts`

### Modified Files (~35)
- `server/src/db.ts` — gutted to thin facade
- `server/src/lib/config.ts` — new `databaseUrl`, `dbEngine` fields
- `server/src/lib/backup.ts` — PG backup branch
- `server/src/lib/binQueries.ts` — dialect helpers for fuzzy/JSON
- `server/src/lib/jobLock.ts` — migrate from `getDb()` to `query()`
- `server/src/lib/importTransaction.ts` — async `withTransaction()`
- `server/src/lib/exportHelpers.ts` — async migration
- `server/src/lib/activityLog.ts` — async migration
- `server/src/lib/photoCleanup.ts` — async migration
- `server/src/lib/queryHelpers.ts` — async migration
- `server/src/lib/customFieldHelpers.ts` — `withTransaction()`
- `server/src/lib/binUpdateHelpers.ts` — `withTransaction()`
- `server/src/lib/userCleanup.ts` — `withTransaction()`
- `server/src/lib/refreshTokens.ts` — migrate from `getDb()`
- `server/src/lib/aiUsageTracker.ts` — migrate from `getDb()`
- `server/src/lib/commandExecutor.ts` — migrate from `getDb()`
- `server/src/lib/managerWebhook.ts` — migrate from `getDb()`
- `server/src/lib/demoSeed.ts` — `withTransaction()`
- `server/src/routes/bins.ts` — `withTransaction()` for change-code + move
- `server/src/routes/locations.ts` — `withTransaction()` for create + delete
- `server/src/routes/binPins.ts` — `withTransaction()` for reorder
- `server/src/routes/customFields.ts` — `withTransaction()` for reorder
- `server/src/routes/export.ts` — async `withTransaction()` for import
- `server/src/routes/admin.ts` — migrate from `getDb()`
- `server/src/routes/tags.ts` — dialect for `json_each`
- `server/src/routes/items.ts` — dialect for `fuzzy_match`
- `server/src/routes/shared.ts` — dialect for `json_each`
- `server/src/middleware/requireAdmin.ts` — migrate from `getDb()`
- `server/src/index.ts` — health check migration
- `server/src/__tests__/setup.ts` — use `db/init.ts`
- `server/package.json` — add `pg`, `@types/pg`
- `Dockerfile` — add `postgresql-client`
- `.env.example` — document `DATABASE_URL`
- `server/schema.sql` — renamed to `server/schema.sqlite.sql`

### Renamed Files
- `server/schema.sql` → `server/schema.sqlite.sql`
