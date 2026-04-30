import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

const SQLITE_ALTER_STATEMENTS = [
  'ALTER TABLE users ADD COLUMN deletion_requested_at TEXT',
  'ALTER TABLE users ADD COLUMN deletion_scheduled_at TEXT',
  'ALTER TABLE users ADD COLUMN deletion_reason TEXT',
];

const POSTGRES_ALTER_STATEMENTS = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TEXT',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_scheduled_at TEXT',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_reason TEXT',
];

const SQLITE_CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS subscription_orphans (
    id                TEXT PRIMARY KEY,
    user_id_attempted TEXT NOT NULL,
    payload_json      TEXT NOT NULL,
    received_at       TEXT NOT NULL DEFAULT (datetime('now')),
    reason            TEXT NOT NULL
  )
`;

const SQLITE_CREATE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_users_deletion_scheduled
  ON users(deletion_scheduled_at)
  WHERE deletion_scheduled_at IS NOT NULL
`;

const POSTGRES_CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS subscription_orphans (
    id                TEXT PRIMARY KEY,
    user_id_attempted TEXT NOT NULL,
    payload_json      TEXT NOT NULL,
    received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason            TEXT NOT NULL
  )
`;

const POSTGRES_CREATE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_users_deletion_scheduled
  ON users(deletion_scheduled_at)
  WHERE deletion_scheduled_at IS NOT NULL
`;

function safeAlterSqlite(db: Database.Database, sql: string): void {
  try {
    db.prepare(sql).run();
  } catch (err) {
    const msg = String((err as Error)?.message ?? '');
    if (/duplicate column name/i.test(msg)) return;
    throw err;
  }
}

export const deletionLifecycle: Migration = {
  name: '0010_deletion_lifecycle',
  sqlite(db) {
    for (const sql of SQLITE_ALTER_STATEMENTS) safeAlterSqlite(db, sql);
    db.exec(SQLITE_CREATE_TABLE);
    db.exec(SQLITE_CREATE_INDEX);
  },
  async postgres(pool) {
    for (const sql of POSTGRES_ALTER_STATEMENTS) {
      await pool.query(sql);
    }
    await pool.query(POSTGRES_CREATE_TABLE);
    await pool.query(POSTGRES_CREATE_INDEX);
  },
};
