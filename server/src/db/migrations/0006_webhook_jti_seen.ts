import type { Migration } from './types.js';

const SQL = `
  CREATE TABLE IF NOT EXISTS webhook_jti_seen (
    jti     TEXT PRIMARY KEY,
    seen_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  );
  CREATE INDEX IF NOT EXISTS idx_webhook_jti_seen_at ON webhook_jti_seen(seen_at);
`;

export const webhookJtiSeen: Migration = {
  name: '0006_webhook_jti_seen',
  sqlite(db) {
    db.exec(SQL);
  },
  async postgres(pool) {
    await pool.query(SQL);
  },
};
