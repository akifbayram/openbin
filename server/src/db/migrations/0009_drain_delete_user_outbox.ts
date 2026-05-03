import type { Migration } from './types.js';

const SQLITE_SQL = `DELETE FROM webhook_outbox WHERE payload_json LIKE '%"action":"delete_user"%' AND sent_at IS NULL`;
// payload_json is JSONB in PostgreSQL; LIKE requires a text operand.
const PG_SQL = `DELETE FROM webhook_outbox WHERE payload_json::text LIKE '%"action":"delete_user"%' AND sent_at IS NULL`;

export const drainDeleteUserOutbox: Migration = {
  name: '0009_drain_delete_user_outbox',
  sqlite(db) {
    db.exec(SQLITE_SQL);
  },
  async postgres(pool) {
    await pool.query(PG_SQL);
  },
};
