import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PG_CONNECTION_STRING =
  'postgres://openbin_test:openbin_test@localhost:5433/openbin_test';

export const TABLES = [
  'email_log',
  'refresh_tokens',
  'scan_history',
  'saved_views',
  'user_preferences',
  'user_print_settings',
  'user_ai_settings',
  'api_keys',
  'pinned_bins',
  'activity_log',
  'photos',
  'bin_custom_field_values',
  'bin_items',
  'bin_shares',
  'bins',
  'areas',
  'tag_colors',
  'location_custom_fields',
  'location_members',
  'locations',
  'users',
  'password_reset_tokens',
  'api_key_daily_usage',
  'ai_usage',
  'settings',
  'webhook_outbox',
  'job_locks',
];

export async function setupPgTestDb(): Promise<pg.Pool> {
  process.env.DATABASE_URL = PG_CONNECTION_STRING;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';

  const { initPostgres } = await import('../postgres.js');
  const { setDialect } = await import('../dialect.js');

  const pool = initPostgres(PG_CONNECTION_STRING);
  setDialect('postgres');

  // Create pg_trgm extension
  await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

  // Load and execute schema inside a transaction
  const schemaPath = path.join(__dirname, '..', '..', '..', 'schema.pg.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query('BEGIN');
  try {
    await pool.query(schemaSql);
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }

  // Create unique indexes (same as runPostgresInit)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_history_user_bin ON scan_history(user_id, bin_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bin_shares_active ON bin_shares(bin_id) WHERE revoked_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_daily ON email_log(user_id, email_type, (left(sent_at, 10)));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(LOWER(email)) WHERE email IS NOT NULL;
  `);

  return pool;
}

export async function teardownPgTestDb(pool: pg.Pool): Promise<void> {
  // Drop all tables in reverse dependency order
  for (const table of TABLES) {
    await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
  }
  await pool.end();
}

export async function truncateAllPgTables(pool: pg.Pool): Promise<void> {
  await pool.query(`TRUNCATE ${TABLES.join(', ')} CASCADE`);
}
