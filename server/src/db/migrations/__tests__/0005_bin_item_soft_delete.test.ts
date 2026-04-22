import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { binItemSoftDelete } from '../0005_bin_item_soft_delete.js';

describe('migration 0005_bin_item_soft_delete', () => {
  it('adds deleted_at column to bin_items', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE bins (id TEXT PRIMARY KEY);
      CREATE TABLE bin_items (
        id TEXT PRIMARY KEY,
        bin_id TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        quantity INTEGER,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    binItemSoftDelete.sqlite!(db);
    const cols = db.prepare(`PRAGMA table_info(bin_items)`).all() as { name: string }[];
    expect(cols.map((c) => c.name)).toContain('deleted_at');
    const idx = db.prepare(`PRAGMA index_list(bin_items)`).all() as { name: string }[];
    expect(idx.map((i) => i.name)).toContain('idx_bin_items_deleted_at');
    db.close();
  });
});
