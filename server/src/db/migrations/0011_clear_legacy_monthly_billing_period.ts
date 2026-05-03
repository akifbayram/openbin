import type Database from 'better-sqlite3';
import type pg from 'pg';
import type { Migration } from './types.js';

// Defensive cleanup migration. The codebase no longer accepts
// billing_period = 'monthly' anywhere — the type union is
// `'quarterly' | 'annual' | null`. Production has zero subscribers
// (alpha), but local dev/seed data may have legacy 'monthly' rows.
// Set those to NULL so the renamed type union doesn't lie about
// existing rows.

export const clearLegacyMonthlyBillingPeriod: Migration = {
  name: '0011_clear_legacy_monthly_billing_period',
  sqlite(db: Database.Database): void {
    db.prepare("UPDATE users SET billing_period = NULL WHERE billing_period = 'monthly'").run();
  },
  async postgres(pool: pg.Pool): Promise<void> {
    await pool.query("UPDATE users SET billing_period = NULL WHERE billing_period = 'monthly'");
  },
};
