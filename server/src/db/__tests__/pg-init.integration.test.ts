import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PG_CONNECTION_STRING, TABLES, } from './pg-setup.js';

let pool: pg.Pool;

/**
 * These tests exercise runPostgresInit() via initialize().
 * Each test starts with a freshly dropped/recreated set of tables.
 * We must reset the module-level `engine` variable in init.ts between tests
 * by using dynamic imports with cache-busting via vi.resetModules().
 */

async function freshPool(): Promise<pg.Pool> {
  const pgMod = await import('pg');
  const p = new pgMod.default.Pool({
    connectionString: PG_CONNECTION_STRING,
    connectionTimeoutMillis: 5000,
  });
  return p;
}

async function dropAllTables(p: pg.Pool): Promise<void> {
  for (const table of TABLES) {
    await p.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
  }
  // Also drop extension to test that init creates it
  await p.query('DROP EXTENSION IF EXISTS pg_trgm');
}

beforeAll(async () => {
  pool = await freshPool();
});

beforeEach(async () => {
  // Reset module cache so initialize() treats each test as a fresh start
  vi.resetModules();
  await dropAllTables(pool);
});

afterAll(async () => {
  // Clean up
  await dropAllTables(pool);
  await pool.end();
});

async function runInitialize() {
  // Set up env for postgres mode
  process.env.DATABASE_URL = PG_CONNECTION_STRING;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  // Force postgres engine selection
  process.env.DB_ENGINE = 'postgres';

  const { initialize } = await import('../init.js');
  return initialize();
}

describe('pg-init: schema loading', () => {
  it('all 26 tables exist after init', async () => {
    await runInitialize();
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const tableNames = rows.map((r: { table_name: string }) => r.table_name);
    for (const expected of TABLES) {
      expect(tableNames).toContain(expected);
    }
  });

  it('pg_trgm extension is installed', async () => {
    await runInitialize();
    const { rows } = await pool.query(
      `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`,
    );
    expect(rows).toHaveLength(1);
  });

  it('settings table contains db_engine = postgres', async () => {
    await runInitialize();
    const { rows } = await pool.query(
      `SELECT value FROM settings WHERE key = 'db_engine'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('postgres');
  });

  it('admin user exists with correct attributes', async () => {
    await runInitialize();
    const { rows } = await pool.query(
      `SELECT username, is_admin, plan, sub_status FROM users WHERE username = 'admin'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe('admin');
    expect(rows[0].is_admin).toBe(true);
    expect(rows[0].plan).toBe(1);
    expect(rows[0].sub_status).toBe(1);
  });
});

describe('pg-init: engine lock', () => {
  it('calling initialize() a second time returns the same engine (idempotent)', async () => {
    const engine1 = await runInitialize();
    // Same module — engine is cached
    const { initialize } = await import('../init.js');
    const engine2 = await initialize();
    expect(engine1).toBe(engine2);
  });

  it('engine mismatch throws error', async () => {
    // First, initialize normally to create tables
    await runInitialize();

    // Manually set db_engine to 'sqlite'
    await pool.query(`UPDATE settings SET value = 'sqlite' WHERE key = 'db_engine'`);

    // Reset modules and try to initialize again — should throw mismatch
    vi.resetModules();
    await expect(runInitialize()).rejects.toThrow(/Engine mismatch/);
  });
});

describe('pg-init: unique indexes', () => {
  it('idx_scan_history_user_bin exists and enforces uniqueness', async () => {
    await runInitialize();
    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_scan_history_user_bin'`,
    );
    expect(rows).toHaveLength(1);

    // Verify it enforces uniqueness
    const userId = (await pool.query(`SELECT id FROM users LIMIT 1`)).rows[0].id;
    const locId = await createLocation(userId);
    const binId = await createBin(locId, userId);
    const scanId1 = crypto.randomUUID();
    const scanId2 = crypto.randomUUID();
    await pool.query(
      `INSERT INTO scan_history (id, user_id, bin_id) VALUES ($1, $2, $3)`,
      [scanId1, userId, binId],
    );
    await expect(
      pool.query(
        `INSERT INTO scan_history (id, user_id, bin_id) VALUES ($1, $2, $3)`,
        [scanId2, userId, binId],
      ),
    ).rejects.toThrow();
  });

  it('idx_bin_shares_active exists as partial unique index', async () => {
    await runInitialize();
    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_bin_shares_active'`,
    );
    expect(rows).toHaveLength(1);
  });

  it('idx_users_email_unique enforces case-insensitive email uniqueness', async () => {
    await runInitialize();
    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_users_email_unique'`,
    );
    expect(rows).toHaveLength(1);

    // Insert two users with same email, different case
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, username, password_hash, display_name, is_admin, email)
       VALUES ($1, 'emailtest1', 'hash', 'E1', FALSE, 'Test@Example.com')`,
      [id1],
    );
    await expect(
      pool.query(
        `INSERT INTO users (id, username, password_hash, display_name, is_admin, email)
         VALUES ($1, 'emailtest2', 'hash', 'E2', FALSE, 'test@example.com')`,
        [id2],
      ),
    ).rejects.toThrow();
  });
});

describe('pg-init: admin seed', () => {
  it('running seedAdminUser twice does not create duplicate', async () => {
    await runInitialize();
    // Initialize again (same module instance — idempotent)
    const { initialize } = await import('../init.js');
    await initialize();
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM users WHERE username = 'admin'`,
    );
    expect(Number(rows[0].count)).toBe(1);
  });
});

// Helpers
import crypto from 'node:crypto';

async function createLocation(userId: string): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO locations (id, name, created_by, invite_code) VALUES ($1, 'Loc', $2, $3)`,
    [id, userId, crypto.randomUUID()],
  );
  return id;
}

async function createBin(locationId: string, userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const shortCode = id.slice(0, 6).toUpperCase();
  await pool.query(
    `INSERT INTO bins (id, short_code, location_id, name, created_by) VALUES ($1, $2, $3, 'Bin', $4)`,
    [id, shortCode, locationId, userId],
  );
  return id;
}
