import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

// ---------------------------------------------------------------------------
// Bug context
//
// `attachments.created_by` and `shopping_list_items.created_by` were defined
// as `TEXT NOT NULL REFERENCES users(id)` with no ON DELETE clause (defaults
// to NO ACTION). When `userCleanup.hardDeleteUser` runs
// `DELETE FROM users WHERE id = $1`, the FK constraint blocks the delete if
// the user has any attachments or shopping list items, leaving the account
// soft-deleted forever.
//
// Other user-referencing tables (photos.created_by, bins.created_by, etc.)
// are nullable + ON DELETE SET NULL. This migration aligns these two tables
// with that convention.
// ---------------------------------------------------------------------------

// SQLite cannot ALTER an existing constraint, so we recreate each table.
// `PRAGMA foreign_keys` is a per-connection setting that cannot be toggled
// inside a transaction, so we disable FKs around the recreate. The runner
// does not wrap migrations in a transaction, so we open one ourselves to
// keep the swap atomic. `PRAGMA foreign_key_check` runs before COMMIT to
// surface any data that would dangle once FKs are re-enabled.
function recreateSqliteTable(
  db: Database.Database,
  createTableSql: string,
  copySql: string,
  oldName: string,
  newName: string,
): void {
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN');
    try {
      db.exec(createTableSql);
      db.exec(copySql);
      db.exec(`DROP TABLE ${oldName}`);
      db.exec(`ALTER TABLE ${newName} RENAME TO ${oldName}`);
      // Verify nothing dangles before we let the commit through.
      const violations = db.prepare('PRAGMA foreign_key_check').all() as unknown[];
      if (violations.length > 0) {
        throw new Error(
          `foreign_key_check failed during ${oldName} recreate: ${JSON.stringify(violations)}`,
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

const SQLITE_ATTACHMENTS_NEW = `
  CREATE TABLE attachments_new (
    id            TEXT PRIMARY KEY,
    bin_id        TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
    filename      TEXT NOT NULL,
    mime_type     TEXT NOT NULL,
    size          INTEGER NOT NULL,
    storage_path  TEXT NOT NULL,
    created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

const SQLITE_ATTACHMENTS_COPY = `
  INSERT INTO attachments_new (id, bin_id, filename, mime_type, size, storage_path, created_by, created_at)
  SELECT id, bin_id, filename, mime_type, size, storage_path, created_by, created_at FROM attachments
`;

const SQLITE_SHOPPING_NEW = `
  CREATE TABLE shopping_list_items_new (
    id              TEXT PRIMARY KEY,
    location_id     TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    origin_bin_id   TEXT REFERENCES bins(id) ON DELETE SET NULL,
    created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

const SQLITE_SHOPPING_COPY = `
  INSERT INTO shopping_list_items_new (id, location_id, name, origin_bin_id, created_by, created_at)
  SELECT id, location_id, name, origin_bin_id, created_by, created_at FROM shopping_list_items
`;

const SQLITE_SHOPPING_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_shopping_list_items_location
    ON shopping_list_items(location_id);
  CREATE INDEX IF NOT EXISTS idx_shopping_list_items_bin
    ON shopping_list_items(origin_bin_id);
`;

// Postgres can ALTER constraints in place. Constraint names follow the
// default `<table>_<column>_fkey` convention since the schema file declares
// them inline without an explicit name.
const PG_SQL = `
  ALTER TABLE attachments
    ALTER COLUMN created_by DROP NOT NULL;
  ALTER TABLE attachments
    DROP CONSTRAINT IF EXISTS attachments_created_by_fkey;
  ALTER TABLE attachments
    ADD CONSTRAINT attachments_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

  ALTER TABLE shopping_list_items
    ALTER COLUMN created_by DROP NOT NULL;
  ALTER TABLE shopping_list_items
    DROP CONSTRAINT IF EXISTS shopping_list_items_created_by_fkey;
  ALTER TABLE shopping_list_items
    ADD CONSTRAINT shopping_list_items_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
`;

export const relaxCreatedByFks: Migration = {
  name: '0010_relax_created_by_fks',
  sqlite(db) {
    recreateSqliteTable(
      db,
      SQLITE_ATTACHMENTS_NEW,
      SQLITE_ATTACHMENTS_COPY,
      'attachments',
      'attachments_new',
    );
    recreateSqliteTable(
      db,
      SQLITE_SHOPPING_NEW,
      SQLITE_SHOPPING_COPY,
      'shopping_list_items',
      'shopping_list_items_new',
    );
    // DROP TABLE removes its indexes; recreate them. (attachments has none.)
    db.exec(SQLITE_SHOPPING_INDEXES);
  },
  async postgres(pool) {
    await pool.query(PG_SQL);
  },
};
