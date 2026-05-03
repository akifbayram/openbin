import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { resetAiCreditPeriods } from '../0012_reset_ai_credit_periods.js';

describe('migration 0012_reset_ai_credit_periods', () => {
  function makeDb(): Database.Database {
    const db = new Database(':memory:');
    db.prepare(`CREATE TABLE users (
      id TEXT PRIMARY KEY,
      ai_credits_used INTEGER NOT NULL DEFAULT 0,
      ai_credits_reset_at TEXT
    )`).run();
    return db;
  }

  it('zeroes ai_credits_used for every user (sqlite)', () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO users (id, ai_credits_used, ai_credits_reset_at) VALUES ('u1', 5, '2026-06-01T00:00:00Z')",
    ).run();
    db.prepare(
      "INSERT INTO users (id, ai_credits_used, ai_credits_reset_at) VALUES ('u2', 24, '2026-07-15T00:00:00Z')",
    ).run();

    resetAiCreditPeriods.sqlite!(db);

    const rows = db.prepare('SELECT id, ai_credits_used FROM users ORDER BY id').all() as Array<{
      id: string;
      ai_credits_used: number;
    }>;
    expect(rows).toEqual([
      { id: 'u1', ai_credits_used: 0 },
      { id: 'u2', ai_credits_used: 0 },
    ]);
  });

  it('clears ai_credits_reset_at for every user (sqlite)', () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO users (id, ai_credits_used, ai_credits_reset_at) VALUES ('u1', 5, '2026-06-01T00:00:00Z')",
    ).run();
    db.prepare(
      "INSERT INTO users (id, ai_credits_used, ai_credits_reset_at) VALUES ('u2', 0, NULL)",
    ).run();

    resetAiCreditPeriods.sqlite!(db);

    const rows = db.prepare('SELECT id, ai_credits_reset_at FROM users ORDER BY id').all() as Array<{
      id: string;
      ai_credits_reset_at: string | null;
    }>;
    expect(rows).toEqual([
      { id: 'u1', ai_credits_reset_at: null },
      { id: 'u2', ai_credits_reset_at: null },
    ]);
  });

  it('is idempotent (sqlite)', () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO users (id, ai_credits_used, ai_credits_reset_at) VALUES ('u1', 5, '2026-06-01T00:00:00Z')",
    ).run();

    resetAiCreditPeriods.sqlite!(db);
    expect(() => resetAiCreditPeriods.sqlite!(db)).not.toThrow();

    const row = db.prepare('SELECT ai_credits_used, ai_credits_reset_at FROM users WHERE id = ?').get('u1') as
      | { ai_credits_used: number; ai_credits_reset_at: string | null }
      | undefined;
    expect(row?.ai_credits_used).toBe(0);
    expect(row?.ai_credits_reset_at).toBeNull();
  });

  it('handles an empty users table without error (sqlite)', () => {
    const db = makeDb();
    expect(() => resetAiCreditPeriods.sqlite!(db)).not.toThrow();
  });
});

describe('migration 0012 is registered', () => {
  it('appears in the migrations index in order', async () => {
    const { migrations } = await import('../index.js');
    const names = migrations.map((m) => m.name);
    const idx = names.indexOf('0012_reset_ai_credit_periods');
    expect(idx).toBeGreaterThan(-1);
    // Must come after 0011 — migrations run in array order.
    expect(idx).toBeGreaterThan(names.indexOf('0011_clear_legacy_monthly_billing_period'));
  });
});
