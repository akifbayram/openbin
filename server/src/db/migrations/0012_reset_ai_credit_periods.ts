import type Database from 'better-sqlite3';
import type pg from 'pg';
import type { Migration } from './types.js';

// Roll the AI credit period boundary to "now" for every user as part of
// the cutover to weighted credits. Both the per-user counter and the
// reset timestamp are zeroed so the next AI call starts a fresh 30-day
// window under the new pricing — there's no clean way to prorate a
// flat-cost month into a weighted-cost month, and trying to migrate the
// counter forward would leave some users instantly over their new cap.
//
// Idempotent by construction: running twice on the same row produces the
// same row state.

export const resetAiCreditPeriods: Migration = {
  name: '0012_reset_ai_credit_periods',
  sqlite(db: Database.Database): void {
    db.prepare('UPDATE users SET ai_credits_used = 0, ai_credits_reset_at = NULL').run();
  },
  async postgres(pool: pg.Pool): Promise<void> {
    await pool.query('UPDATE users SET ai_credits_used = 0, ai_credits_reset_at = NULL');
  },
};
