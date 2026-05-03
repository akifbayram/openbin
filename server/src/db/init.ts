import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { config } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { setDialect } from './dialect.js';
import { migrations } from './migrations/index.js';
import { runPostgresMigrations, runSqliteMigrations } from './migrations/runner.js';
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
  const adminEmail = config.adminEmail || 'admin@openbin.local';

  const { rows: existingAdmins } = await eng.query<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE is_admin = TRUE LIMIT 1',
  );
  const existingAdmin = existingAdmins[0] ?? null;

  // Recovery path: rotate the existing admin's password from ADMIN_PASSWORD.
  if (config.adminPasswordReset && existingAdmin) {
    if (!config.adminPassword) {
      log.warn('ADMIN_PASSWORD_RESET=true but ADMIN_PASSWORD is not set — ignoring.');
      return;
    }
    const hash = await bcrypt.hash(config.adminPassword, config.bcryptRounds);
    await eng.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, existingAdmin.id]);
    log.warn(
      `Admin password reset for ${existingAdmin.email}. ` +
        'Remove ADMIN_PASSWORD_RESET=true from the environment to prevent a reset on every boot.',
    );
    return;
  }
  if (config.adminPasswordReset && !existingAdmin) {
    log.warn('ADMIN_PASSWORD_RESET=true but no admin user exists yet — proceeding with normal seed.');
  }

  if (existingAdmin && !config.adminReseed) {
    if (config.adminPassword) {
      log.warn(
        'Admin user already exists; ADMIN_PASSWORD is ignored on subsequent boots. ' +
          'To rotate the admin password, set ADMIN_PASSWORD_RESET=true (with ADMIN_PASSWORD) for one boot.',
      );
    }
    if (config.adminEmail && config.adminEmail !== existingAdmin.email) {
      log.warn(
        `ADMIN_EMAIL (${config.adminEmail}) differs from the existing admin (${existingAdmin.email}); ` +
          'change the admin email through the admin UI instead.',
      );
    }
    return;
  }

  if (existingAdmin && config.adminReseed) {
    log.warn('ADMIN_RESEED=true — seeding an additional admin alongside the existing one.');
  }

  if (!config.adminEmail) {
    log.warn(
      `ADMIN_EMAIL is not set; seeding default '${adminEmail}'. ` +
        'Password-reset emails sent to this address will bounce. Set ADMIN_EMAIL to a deliverable address.',
    );
  }

  const providedPassword = config.adminPassword;
  const plaintext = providedPassword || crypto.randomBytes(12).toString('base64url');
  const hash = await bcrypt.hash(plaintext, config.bcryptRounds);

  // ON CONFLICT (email) DO NOTHING guards against a rare startup race (e.g. rolling restart).
  const { rows: inserted } = await eng.query<{ id: string }>(
    `INSERT INTO users (id, email, password_hash, display_name, is_admin, plan, sub_status, active_until)
     VALUES ($1, $2, $3, 'Admin', TRUE, 1, 1, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [crypto.randomUUID(), adminEmail, hash, new Date(Date.now() + ADMIN_ACTIVE_UNTIL_MS).toISOString()],
  );

  if (inserted.length === 0) {
    log.info(`Admin user at ${adminEmail} already exists — skipping seed.`);
    return;
  }

  if (providedPassword) {
    log.info(`Initial admin account created for ${adminEmail}`);
  } else {
    console.log('========================================');
    console.log('  Initial admin credentials:');
    console.log(`    Email: ${adminEmail}`);
    console.log(`    Password: ${plaintext}`);
    console.log('  Save this password — it will not be shown again.');
    console.log('========================================');
  }
}

// ---------------------------------------------------------------------------
// System user seed helper
// ---------------------------------------------------------------------------

/**
 * Bootstrap a 'system' user row so admin_audit_log entries from system
 * actors (e.g. inactivityChecker invoking requestDeletion with
 * `initiatedByAdminId: 'system'`) can satisfy the actor_id FK without
 * being silently dropped by logAdminAction's catch handler.
 *
 * The row is intentionally unable to log in:
 *   - password_hash NULL (no credential)
 *   - suspended_at set permanently (any auth attempt is rejected)
 *   - is_admin FALSE (does not count toward admin caps or last-admin guards)
 *   - sub_status INACTIVE (not surfaced as a billing customer)
 *
 * The id is the literal string 'system' (not a UUID) so any code attributing
 * an action to "system" can pass it directly without a lookup.
 */
async function seedSystemUser(eng: DatabaseEngine): Promise<void> {
  // CURRENT_TIMESTAMP is portable across SQLite and Postgres — avoids needing
  // setDialect() to have been called before this seed runs (it hasn't yet).
  await eng.query(
    `INSERT INTO users (id, email, display_name, password_hash, is_admin, plan, sub_status, suspended_at)
     VALUES ('system', 'system@openbin.local', 'System', NULL, FALSE, 1, 0, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
  );
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
 * Close the database engine without re-initializing.
 * Used by backup restore to release the file before overwriting it.
 */
export async function closeDb(): Promise<void> {
  if (engine) {
    await engine.close();
    engine = null;
  }
}

/**
 * Close the current engine and re-initialize from scratch.
 * Used by backup restore to swap the database file at runtime.
 */
export async function reinitialize(): Promise<DatabaseEngine> {
  await closeDb();
  return initialize();
}

// ---------------------------------------------------------------------------
// SQLite initialization
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

  runSqliteMigrations(db, migrations);

  const sqliteEngine = createSqliteEngine();
  await seedAdminUser(sqliteEngine);
  await seedSystemUser(sqliteEngine);
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

  // Settings table (needed for engine lock before migrations run)
  await pool.query('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

  await runPostgresMigrations(pool, migrations);

  const pgEngine = createPostgresEngine();
  await seedAdminUser(pgEngine);
  await seedSystemUser(pgEngine);
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
