import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { deletionLifecycle } from '../0010_deletion_lifecycle.js';

describe('migration 0010_deletion_lifecycle', () => {
  it('adds 3 deletion columns + creates orphans table + index (sqlite)', () => {
    const db = new Database(':memory:');
    db.prepare('CREATE TABLE users (id TEXT PRIMARY KEY, plan INTEGER)').run();

    deletionLifecycle.sqlite!(db);

    const cols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    expect(cols.find(c => c.name === 'deletion_requested_at')).toBeDefined();
    expect(cols.find(c => c.name === 'deletion_scheduled_at')).toBeDefined();
    expect(cols.find(c => c.name === 'deletion_reason')).toBeDefined();

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subscription_orphans'").all();
    expect(tables.length).toBe(1);

    const orphanCols = db.prepare('PRAGMA table_info(subscription_orphans)').all() as Array<{ name: string }>;
    expect(orphanCols.map(c => c.name).sort()).toEqual(
      ['id', 'payload_json', 'reason', 'received_at', 'user_id_attempted'].sort()
    );

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_users_deletion_scheduled'").all();
    expect(indexes.length).toBe(1);
  });

  it('is idempotent', () => {
    const db = new Database(':memory:');
    db.prepare('CREATE TABLE users (id TEXT PRIMARY KEY, plan INTEGER)').run();

    deletionLifecycle.sqlite!(db);
    expect(() => deletionLifecycle.sqlite!(db)).not.toThrow();
  });
});
