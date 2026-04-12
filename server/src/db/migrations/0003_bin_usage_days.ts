import type { Migration } from './types.js';

const SQL = `
  CREATE TABLE IF NOT EXISTS bin_usage_days (
    bin_id           TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
    date             TEXT NOT NULL,
    count            INTEGER NOT NULL DEFAULT 1,
    last_user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
    last_recorded_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    PRIMARY KEY (bin_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_bin_usage_days_date ON bin_usage_days(date);
  CREATE INDEX IF NOT EXISTS idx_bin_usage_days_bin ON bin_usage_days(bin_id, date DESC);
`;

export const binUsageDays: Migration = {
  name: '0003_bin_usage_days',
  sqlite(db) {
    db.exec(SQL);
  },
  async postgres(pool) {
    await pool.query(SQL);
  },
};
