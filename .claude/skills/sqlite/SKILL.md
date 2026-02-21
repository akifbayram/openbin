---
name: sqlite
description: SQLite conventions and db.ts wrapper details for server-side database work
---
# SQLite Conventions

- **db.ts wrapper**: `query()` converts `$1,$2` → `?`, auto-serializes arrays to JSON, auto-deserializes JSON columns. `querySync()` for transactions. `generateUuid()` for all INSERTs.
- **Syntax**: `json_each()` not `unnest()`. `datetime('now')` not `now()`. Error code `SQLITE_CONSTRAINT_UNIQUE` not `23505`.
