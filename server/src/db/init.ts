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
  const { rows } = await eng.query('SELECT 1 FROM users WHERE email = $1', [adminEmail]);
  if (rows.length === 0) {
    const plaintext = config.adminPassword || crypto.randomBytes(12).toString('base64url');
    const hash = await bcrypt.hash(plaintext, config.bcryptRounds);

    await eng.query(
      `INSERT INTO users (id, email, password_hash, display_name, is_admin, plan, sub_status, active_until)
       VALUES ($1, $2, $3, 'Admin', TRUE, 1, 1, $4)`,
      [crypto.randomUUID(), adminEmail, hash, new Date(Date.now() + ADMIN_ACTIVE_UNTIL_MS).toISOString()],
    );

    console.log('========================================');
    console.log('  Initial admin credentials:');
    console.log(`    Email: ${adminEmail}`);
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

  // Settings table (needed for engine lock before migrations run)
  await pool.query('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

  await runPostgresMigrations(pool, migrations);

  const pgEngine = createPostgresEngine();

  // Seed default admin account — idempotent
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
