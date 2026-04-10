import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

function addColumnIfNotExists(db: Database.Database, stmt: string): void {
  try {
    db.exec(stmt);
  } catch (err) {
    if (err instanceof Error && err.message.includes('duplicate column name')) return;
    throw err;
  }
}

export const shareExpires: Migration = {
  name: '0002_share_expires',
  sqlite(db) {
    addColumnIfNotExists(db, 'ALTER TABLE bin_shares ADD COLUMN expires_at TEXT');
  },
  async postgres(pool) {
    await pool.query('ALTER TABLE bin_shares ADD COLUMN IF NOT EXISTS expires_at TEXT');
  },
};
