import type { Migration } from './types.js';

const SQLITE_SQL = `
  ALTER TABLE bin_items ADD COLUMN deleted_at TEXT;
  CREATE INDEX IF NOT EXISTS idx_bin_items_deleted_at ON bin_items(deleted_at);
`;

const PG_SQL = `
  ALTER TABLE bin_items ADD COLUMN IF NOT EXISTS deleted_at TEXT;
  CREATE INDEX IF NOT EXISTS idx_bin_items_deleted_at ON bin_items(deleted_at);
`;

export const binItemSoftDelete: Migration = {
  name: '0005_bin_item_soft_delete',
  sqlite(db) {
    db.exec(SQLITE_SQL);
  },
  async postgres(pool) {
    await pool.query(PG_SQL);
  },
};
