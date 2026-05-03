import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

const SQLITE_STATEMENTS = [
  'ALTER TABLE users ADD COLUMN cancel_at_period_end TEXT',
  'ALTER TABLE users ADD COLUMN billing_period TEXT',
];

const POSTGRES_STATEMENTS = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_at_period_end TEXT',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_period TEXT',
];

function safeAlterSqlite(db: Database.Database, sql: string): void {
  try {
    db.prepare(sql).run();
  } catch (err) {
    const msg = String((err as Error)?.message ?? '');
    if (/duplicate column name/i.test(msg)) return;
    throw err;
  }
}

export const subscriptionState: Migration = {
  name: '0007_subscription_state',
  sqlite(db) {
    for (const sql of SQLITE_STATEMENTS) safeAlterSqlite(db, sql);
  },
  async postgres(pool) {
    for (const sql of POSTGRES_STATEMENTS) {
      await pool.query(sql);
    }
  },
};
