import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { config } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { setDialect } from './dialect.js';
import { createPostgresEngine, initPostgres } from './postgres.js';
import { createSqliteEngine, initSqlite } from './sqlite.js';
import type { DatabaseEngine } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = createLogger('db:init');

let engine: DatabaseEngine | null = null;

// ---------------------------------------------------------------------------
// Admin seed helper
// ---------------------------------------------------------------------------

const ADMIN_ACTIVE_UNTIL_MS = 1000 * 365 * 24 * 60 * 60 * 1000;

async function seedAdminUser(eng: DatabaseEngine): Promise<void> {
  const { rows } = await eng.query("SELECT 1 FROM users WHERE username = 'admin'");
  if (rows.length === 0) {
    const plaintext = config.adminPassword || crypto.randomBytes(12).toString('base64url');
    const hash = await bcrypt.hash(plaintext, config.bcryptRounds);

    await eng.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin, plan, sub_status, active_until)
       VALUES ($1, 'admin', $2, 'Admin', TRUE, 1, 1, $3)`,
      [crypto.randomUUID(), hash, new Date(Date.now() + ADMIN_ACTIVE_UNTIL_MS).toISOString()],
    );

    console.log('========================================');
    console.log('  Initial admin credentials:');
    console.log('    Username: admin');
    console.log(`    Password: ${plaintext}`);
    console.log('========================================');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the database engine.
 * Must be called exactly once before the server starts accepting requests.
 */
export async function initialize(): Promise<DatabaseEngine> {
  if (engine) return engine;

  if (config.dbEngine === 'postgres') {
    engine = await runPostgresInit();
  } else {
    engine = await runSqliteInit();
  }

  setDialect(engine.dialect);
  await enforceEngineLock(engine, engine.dialect);

  log.info(`Database engine initialized: ${engine.dialect}`);
  return engine;
}

/**
 * Return the active DatabaseEngine.
 * Throws if initialize() has not been called.
 */
export function getEngine(): DatabaseEngine {
  if (!engine) throw new Error('Database not initialized — call initialize() first');
  return engine;
}

/**
 * Close the current engine and re-initialize from scratch.
 * Used by backup restore to swap the database file at runtime.
 */
export async function reinitialize(): Promise<DatabaseEngine> {
  if (engine) {
    await engine.close();
    engine = null;
  }
  return initialize();
}

// ---------------------------------------------------------------------------
// SQLite initialization (all migrations from the original db.ts)
// ---------------------------------------------------------------------------

async function runSqliteInit(): Promise<DatabaseEngine> {
  const DB_PATH = config.databasePath;

  // Ensure directory exists
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  // Create connection (sets WAL, foreign keys, registers fuzzy_match UDF)
  const db = initSqlite(DB_PATH);

  // Load schema (all CREATE IF NOT EXISTS — safe to run on every start)
  const schemaPath = path.join(__dirname, '..', '..', 'schema.sqlite.sql');
  if (fs.existsSync(schemaPath)) {
    db.exec(fs.readFileSync(schemaPath, 'utf-8'));
  }

  // ------------------------------------------------------------------
  // Column migrations for existing databases
  // (ALTER TABLE ADD COLUMN errors if column already exists)
  // ------------------------------------------------------------------
  try {

  // AI settings columns
  const aiSettingsMigrations = [
    'temperature REAL',
    'max_tokens INTEGER',
    'top_p REAL',
    'request_timeout INTEGER',
    'reorganization_prompt TEXT',
  ];
  for (const colDef of aiSettingsMigrations) {
    try { db.exec(`ALTER TABLE user_ai_settings ADD COLUMN ${colDef}`); } catch { /* column already exists */ }
  }

  try { db.exec('ALTER TABLE bin_items ADD COLUMN quantity INTEGER DEFAULT NULL'); } catch { /* column already exists */ }
  try { db.exec('ALTER TABLE user_ai_settings ADD COLUMN task_model_overrides TEXT'); } catch { /* column already exists */ }

  // Hierarchical areas: add parent_id column
  try { db.exec('ALTER TABLE areas ADD COLUMN parent_id TEXT REFERENCES areas(id) ON DELETE CASCADE'); } catch { /* column already exists */ }

  // Hierarchical areas: migrate UNIQUE constraint from (location_id, name) to (location_id, parent_id, name)
  {
    const areaTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='areas'").get() as { sql: string } | undefined;
    if (areaTableInfo?.sql && !areaTableInfo.sql.includes('parent_id, name')) {
      db.exec('BEGIN');
      try {
        db.exec('DROP TABLE IF EXISTS areas_new');
        db.exec(`CREATE TABLE areas_new (
          id            TEXT PRIMARY KEY,
          location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
          name          TEXT NOT NULL,
          parent_id     TEXT REFERENCES areas(id) ON DELETE CASCADE,
          created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at    TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(location_id, parent_id, name)
        )`);
        db.exec(`INSERT INTO areas_new (id, location_id, name, parent_id, created_by, created_at, updated_at)
          SELECT id, location_id, name, parent_id, created_by, created_at, updated_at FROM areas`);
        db.exec('DROP TABLE areas');
        db.exec('ALTER TABLE areas_new RENAME TO areas');
        db.exec('CREATE INDEX IF NOT EXISTS idx_areas_location_id ON areas(location_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_areas_parent_id ON areas(parent_id)');
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    }
  }

  // Viewer role: add default_join_role to locations
  try { db.exec("ALTER TABLE locations ADD COLUMN default_join_role TEXT NOT NULL DEFAULT 'member' CHECK (default_join_role IN ('member', 'viewer'))"); } catch { /* column already exists */ }

  // AI usage tracking (daily budget for demo users)
  db.exec([
    'CREATE TABLE IF NOT EXISTS ai_usage (',
    '  id         INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  user_id    TEXT NOT NULL,',
    '  call_count INTEGER NOT NULL DEFAULT 1,',
    "  date       TEXT NOT NULL DEFAULT (date('now')),",
    "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
    '  UNIQUE(user_id, date)',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, date);',
  ].join('\n'));

  // Viewer role: widen location_members.role CHECK constraint to include 'viewer'
  // SQLite can't ALTER CHECK constraints, so recreate the table if the old constraint exists
  {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='location_members'").get() as { sql: string } | undefined;
    if (tableInfo?.sql && !tableInfo.sql.includes("'viewer'")) {
      db.exec('BEGIN');
      try {
        db.exec('DROP TABLE IF EXISTS location_members_new');
        db.exec(`CREATE TABLE location_members_new (
          id            TEXT PRIMARY KEY,
          location_id   TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
          user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
          joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(location_id, user_id)
        )`);
        db.exec('INSERT INTO location_members_new SELECT * FROM location_members');
        db.exec('DROP TABLE location_members');
        db.exec('ALTER TABLE location_members_new RENAME TO location_members');
        db.exec('CREATE INDEX IF NOT EXISTS idx_location_members_user ON location_members(user_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_location_members_location ON location_members(location_id)');
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    }
  }

  // Cloud tier: plan and subscription columns for users
  try { db.exec('ALTER TABLE users ADD COLUMN plan INTEGER NOT NULL DEFAULT 1'); } catch { /* column already exists */ }
  try { db.exec('ALTER TABLE users ADD COLUMN sub_status INTEGER NOT NULL DEFAULT 1'); } catch { /* column already exists */ }
  try { db.exec('ALTER TABLE users ADD COLUMN active_until TEXT'); } catch { /* column already exists */ }
  try { db.exec('ALTER TABLE users ADD COLUMN previous_sub_status INTEGER'); } catch { /* column already exists */ }
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan, sub_status)');

  // Global admin role
  try { db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0'); } catch { /* column already exists */ }

  // Soft delete for users
  try { db.exec('ALTER TABLE users ADD COLUMN deleted_at TEXT'); } catch { /* column already exists */ }

  // Unique email (case-insensitive) — deduplicate before creating index on existing DBs
  createUniqueIndexWithDedup(
    db,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(LOWER(email)) WHERE email IS NOT NULL',
    `UPDATE users SET email = NULL
     WHERE email IS NOT NULL
       AND rowid NOT IN (
         SELECT MAX(rowid) FROM users WHERE email IS NOT NULL GROUP BY LOWER(email)
       )`,
  );

  // Global settings key-value store (e.g. runtime registration mode override)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Unique scan history per (user, bin) — deduplicate if needed
  createUniqueIndexWithDedup(
    db,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_history_user_bin ON scan_history(user_id, bin_id)',
    `DELETE FROM scan_history
     WHERE rowid NOT IN (
       SELECT MAX(rowid) FROM scan_history GROUP BY user_id, bin_id
     )`,
  );

  // Bin sharing table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bin_shares (
      id          TEXT PRIMARY KEY,
      bin_id      TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
      token       TEXT NOT NULL UNIQUE,
      visibility  TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('public', 'unlisted')),
      created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
      view_count  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bin_shares_token ON bin_shares(token) WHERE revoked_at IS NULL;
  `);
  createUniqueIndexWithDedup(
    db,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_bin_shares_active ON bin_shares(bin_id) WHERE revoked_at IS NULL',
    `UPDATE bin_shares SET revoked_at = datetime('now')
     WHERE revoked_at IS NULL
       AND rowid NOT IN (
         SELECT MAX(rowid) FROM bin_shares WHERE revoked_at IS NULL GROUP BY bin_id
       )`,
  );

  // API key daily usage tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_key_daily_usage (
      api_key_id    TEXT NOT NULL,
      date          TEXT NOT NULL DEFAULT (date('now')),
      request_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (api_key_id, date)
    );
  `);

  // Email deduplication log
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_log (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email_type TEXT NOT NULL,
      sent_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_email_log_dedup ON email_log(user_id, email_type, sent_at);
  `);

  // Webhook outbox for reliable Manager notifications
  db.exec(`CREATE TABLE IF NOT EXISTS webhook_outbox (
    id            TEXT PRIMARY KEY,
    endpoint      TEXT NOT NULL,
    payload_json  TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at       TEXT,
    attempts      INTEGER NOT NULL DEFAULT 0,
    last_error    TEXT,
    next_retry_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_webhook_outbox_pending ON webhook_outbox(next_retry_at) WHERE sent_at IS NULL');

  // Job locks for background job leader election
  db.exec(`CREATE TABLE IF NOT EXISTS job_locks (
    job_name   TEXT PRIMARY KEY,
    locked_by  TEXT NOT NULL,
    locked_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  )`);

  // Atomic email dedup: one email per type per user per day
  createUniqueIndexWithDedup(
    db,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_daily ON email_log(user_id, email_type, date(sent_at))',
    `DELETE FROM email_log
     WHERE rowid NOT IN (
       SELECT MAX(rowid) FROM email_log GROUP BY user_id, email_type, date(sent_at)
     )`,
  );

  } catch (e) {
    log.error('Migration failed — exiting to prevent corrupt state:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const sqliteEngine = createSqliteEngine();

  // Seed default admin account — idempotent
  await seedAdminUser(sqliteEngine);

  return sqliteEngine;
}

// ---------------------------------------------------------------------------
// PostgreSQL initialization
// ---------------------------------------------------------------------------

async function runPostgresInit(): Promise<DatabaseEngine> {
  const connectionString = config.databaseUrl;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for PostgreSQL mode');
  }

  const pool = initPostgres(connectionString);

  // Connectivity check
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    throw new Error(`Cannot connect to PostgreSQL: ${err instanceof Error ? err.message : err}`);
  }

  // pg_trgm for fuzzy matching
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  } catch {
    log.warn('Could not create pg_trgm extension — fuzzy search may not work');
  }

  // Load PG schema
  const schemaPath = path.join(__dirname, '..', '..', 'schema.pg.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query('BEGIN');
    try {
      await pool.query(schemaSql);
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  } else {
    log.warn('PostgreSQL schema file not found at %s — skipping schema load', schemaPath);
  }

  // Settings table (needed for engine lock before other migrations)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Unique indexes (PG equivalent of SQLite dedup-then-create migrations)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_history_user_bin ON scan_history(user_id, bin_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bin_shares_active ON bin_shares(bin_id) WHERE revoked_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_daily ON email_log(user_id, email_type, (left(sent_at, 10)));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(LOWER(email)) WHERE email IS NOT NULL;
  `);

  const pgEngine = createPostgresEngine();

  // Seed default admin account (admin/admin) — idempotent
  await seedAdminUser(pgEngine);

  return pgEngine;
}

// ---------------------------------------------------------------------------
// Engine lock-in
// ---------------------------------------------------------------------------

/**
 * Ensure the database was not previously initialized with a different engine.
 * On first run, records the engine in the settings table.
 * On subsequent runs, verifies it matches.
 */
async function enforceEngineLock(eng: DatabaseEngine, expected: 'sqlite' | 'postgres'): Promise<void> {
  const result = await eng.query<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'db_engine'",
  );
  if (result.rows.length === 0) {
    await eng.query("INSERT INTO settings (key, value) VALUES ('db_engine', $1)", [expected]);
  } else if (result.rows[0].value !== expected) {
    throw new Error(
      `Engine mismatch: this database was initialized with "${result.rows[0].value}" ` +
      `but the current config specifies "${expected}". Changing engines requires a data migration.`,
    );
  }
}

// ---------------------------------------------------------------------------
// SQLite helpers
// ---------------------------------------------------------------------------

/** Try to create a unique index; if duplicates exist, run dedupSql first then retry. */
function createUniqueIndexWithDedup(
  db: import('better-sqlite3').Database,
  indexDdl: string,
  dedupSql: string,
): void {
  try {
    db.exec(indexDdl);
  } catch {
    db.exec(dedupSql);
    db.exec(indexDdl);
  }
}
