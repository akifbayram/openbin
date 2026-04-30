import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { clearLegacyMonthlyBillingPeriod } from '../0011_clear_legacy_monthly_billing_period.js';

describe('migration 0011_clear_legacy_monthly_billing_period', () => {
  it('clears billing_period = "monthly" rows (sqlite)', () => {
    const db = new Database(':memory:');
    db.prepare('CREATE TABLE users (id TEXT PRIMARY KEY, billing_period TEXT)').run();
    db.prepare("INSERT INTO users (id, billing_period) VALUES ('u1', 'monthly')").run();
    db.prepare("INSERT INTO users (id, billing_period) VALUES ('u2', 'annual')").run();
    db.prepare("INSERT INTO users (id, billing_period) VALUES ('u3', NULL)").run();

    clearLegacyMonthlyBillingPeriod.sqlite!(db);

    const rows = db.prepare('SELECT id, billing_period FROM users ORDER BY id').all() as Array<{
      id: string;
      billing_period: string | null;
    }>;
    expect(rows).toEqual([
      { id: 'u1', billing_period: null },
      { id: 'u2', billing_period: 'annual' },
      { id: 'u3', billing_period: null },
    ]);
  });

  it('is idempotent (sqlite)', () => {
    const db = new Database(':memory:');
    db.prepare('CREATE TABLE users (id TEXT PRIMARY KEY, billing_period TEXT)').run();
    db.prepare("INSERT INTO users (id, billing_period) VALUES ('u1', 'monthly')").run();

    clearLegacyMonthlyBillingPeriod.sqlite!(db);
    expect(() => clearLegacyMonthlyBillingPeriod.sqlite!(db)).not.toThrow();

    const row = db.prepare('SELECT billing_period FROM users WHERE id = ?').get('u1') as
      | { billing_period: string | null }
      | undefined;
    expect(row?.billing_period).toBeNull();
  });
});
