import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  const mockPgPool = {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
  };
  const mockPgEngine = {
    query: vi.fn(),
    querySync: vi.fn(),
    withTransaction: vi.fn(),
    close: vi.fn(),
    dialect: 'postgres' as const,
  };
  const mockSqliteEngine = {
    query: vi.fn(),
    querySync: vi.fn(),
    withTransaction: vi.fn(),
    close: vi.fn(),
    dialect: 'sqlite' as const,
  };
  return { mockPgPool, mockPgEngine, mockSqliteEngine };
});

// Mock pg module (needed by postgres.ts import chain)
vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => h.mockPgPool),
    types: { setTypeParser: vi.fn() },
  },
}));

vi.mock('../postgres.js', () => ({
  initPostgres: vi.fn(() => h.mockPgPool),
  getPool: vi.fn(() => h.mockPgPool),
  createPostgresEngine: vi.fn(() => h.mockPgEngine),
}));

vi.mock('../sqlite.js', () => ({
  initSqlite: vi.fn(() => ({
    exec: vi.fn(),
    prepare: vi.fn(() => ({ get: vi.fn() })),
    pragma: vi.fn(),
  })),
  getSqliteDb: vi.fn(),
  createSqliteEngine: vi.fn(() => h.mockSqliteEngine),
}));

vi.mock('../dialect.js', () => ({
  setDialect: vi.fn(),
  getDialect: vi.fn(() => 'sqlite'),
}));

vi.mock('bcrypt', () => ({
  default: { hash: vi.fn().mockResolvedValue('$2b$12$mockhash') },
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    dbEngine: 'sqlite' as 'sqlite' | 'postgres',
    databasePath: ':memory:',
    databaseUrl: null as string | null,
    adminPassword: null as string | null,
    adminEmail: null as string | null,
    adminPasswordReset: false,
    adminReseed: false,
    bcryptRounds: 12,
  },
}));

vi.mock('node:fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => 'CREATE TABLE IF NOT EXISTS test (id TEXT);'),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../migrations/index.js', () => ({
  migrations: [],
}));

vi.mock('../migrations/runner.js', () => ({
  runSqliteMigrations: vi.fn(),
  runPostgresMigrations: vi.fn(),
}));

vi.resetModules();

const { initialize, getEngine } = await import('../init.js');
const { config: frozenConfig } = await import('../../lib/config.js');
const { setDialect } = await import('../dialect.js');
const { initPostgres, createPostgresEngine } = await import('../postgres.js');

const config = frozenConfig as unknown as {
  dbEngine: 'sqlite' | 'postgres';
  databaseUrl: string | null;
  adminPassword: string | null;
  adminEmail: string | null;
  adminPasswordReset: boolean;
  adminReseed: boolean;
};

// ---------------------------------------------------------------------------
// Reset between tests — clear module-level `engine` by re-importing
// ---------------------------------------------------------------------------

let reinitialize: typeof initialize;
let regetEngine: typeof getEngine;

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset module to clear engine state
  vi.resetModules();
  const mod = await import('../init.js');
  reinitialize = mod.initialize;
  regetEngine = mod.getEngine;

  // Default: sqlite mode with successful engine lock
  config.dbEngine = 'sqlite';
  config.databaseUrl = null;
  config.adminPassword = null;
  config.adminEmail = null;
  config.adminPasswordReset = false;
  config.adminReseed = false;
  h.mockSqliteEngine.query.mockResolvedValue({ rows: [], rowCount: 0 });
  h.mockPgEngine.query.mockResolvedValue({ rows: [], rowCount: 0 });
  h.mockPgPool.query.mockResolvedValue({ rows: [] });
});

afterAll(async () => {
  vi.restoreAllMocks();
  vi.resetModules();
  const { initialize: init } = await import('../init.js');
  try { await init(); } catch { /* best-effort */ }
});

// ---------------------------------------------------------------------------
// getEngine
// ---------------------------------------------------------------------------

describe('getEngine', () => {
  it('throws before initialize is called', () => {
    expect(() => regetEngine()).toThrow('Database not initialized — call initialize() first');
  });
});

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

describe('initialize', () => {
  it('selects sqlite when config.dbEngine is sqlite', async () => {
    config.dbEngine = 'sqlite';

    const engine = await reinitialize();

    expect(engine.dialect).toBe('sqlite');
    expect(setDialect).toHaveBeenCalledWith('sqlite');
  });

  it('selects postgres when config.dbEngine is postgres', async () => {
    config.dbEngine = 'postgres';
    config.databaseUrl = 'postgres://localhost/test';

    const engine = await reinitialize();

    expect(engine.dialect).toBe('postgres');
    expect(setDialect).toHaveBeenCalledWith('postgres');
  });

  it('is idempotent on second call', async () => {
    config.dbEngine = 'sqlite';

    const first = await reinitialize();
    const second = await reinitialize();

    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// enforceEngineLock
// ---------------------------------------------------------------------------

describe('enforceEngineLock', () => {
  it('records engine on first run (no existing setting)', async () => {
    h.mockSqliteEngine.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SELECT from settings
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT into settings
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // seedAdminUser SELECT

    await reinitialize();

    // Second query should be the INSERT for engine lock
    const insertCall = h.mockSqliteEngine.query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes("INSERT INTO settings"),
    );
    expect(insertCall).toBeDefined();
  });

  it('throws on engine mismatch', async () => {
    h.mockSqliteEngine.query
      .mockResolvedValueOnce({ rows: [{ id: '1' }], rowCount: 1 }) // seedAdminUser — admin exists
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // seedSystemUser INSERT
      .mockResolvedValueOnce({ rows: [{ value: 'postgres' }], rowCount: 1 }); // engine lock — mismatch

    await expect(reinitialize()).rejects.toThrow('Engine mismatch');
  });

  it('passes when engine matches stored value', async () => {
    h.mockSqliteEngine.query
      .mockResolvedValueOnce({ rows: [{ id: '1' }], rowCount: 1 }) // seedAdminUser — admin exists
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // seedSystemUser INSERT
      .mockResolvedValueOnce({ rows: [{ value: 'sqlite' }], rowCount: 1 }); // engine lock — match

    const engine = await reinitialize();
    expect(engine.dialect).toBe('sqlite');
  });
});

// ---------------------------------------------------------------------------
// runPostgresInit
// ---------------------------------------------------------------------------

describe('runPostgresInit', () => {
  it('throws without DATABASE_URL', async () => {
    config.dbEngine = 'postgres';
    config.databaseUrl = null;

    await expect(reinitialize()).rejects.toThrow('DATABASE_URL is required for PostgreSQL mode');
  });

  it('calls initPostgres with connection string', async () => {
    config.dbEngine = 'postgres';
    config.databaseUrl = 'postgres://localhost/test';

    await reinitialize();

    expect(initPostgres).toHaveBeenCalledWith('postgres://localhost/test');
  });

  it('attempts pg_trgm extension creation', async () => {
    config.dbEngine = 'postgres';
    config.databaseUrl = 'postgres://localhost/test';

    await reinitialize();

    expect(h.mockPgPool.query).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  });

  it('warns on pg_trgm failure but continues', async () => {
    config.dbEngine = 'postgres';
    config.databaseUrl = 'postgres://localhost/test';
    h.mockPgPool.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // SELECT 1
      .mockRejectedValueOnce(new Error('pg_trgm not available')) // CREATE EXTENSION
      .mockResolvedValue({ rows: [] }); // everything else

    // Should not throw
    await reinitialize();

    expect(createPostgresEngine).toHaveBeenCalled();
  });

  it('loads schema in a transaction (BEGIN/COMMIT)', async () => {
    config.dbEngine = 'postgres';
    config.databaseUrl = 'postgres://localhost/test';

    await reinitialize();

    const calls = h.mockPgPool.query.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain('BEGIN');
    expect(calls).toContain('COMMIT');
  });

  it('rolls back on schema failure', async () => {
    config.dbEngine = 'postgres';
    config.databaseUrl = 'postgres://localhost/test';

    let callCount = 0;
    h.mockPgPool.query.mockImplementation(async (sql: string) => {
      callCount++;
      // Fail on the schema SQL (after SELECT 1, pg_trgm, BEGIN)
      if (sql === 'BEGIN') return { rows: [] };
      if (callCount === 4) throw new Error('schema load failed'); // schema SQL after BEGIN
      return { rows: [] };
    });

    await expect(reinitialize()).rejects.toThrow('schema load failed');

    const calls = h.mockPgPool.query.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain('ROLLBACK');
  });
});

// ---------------------------------------------------------------------------
// seedAdminUser — admin hardening
// ---------------------------------------------------------------------------

describe('seedAdminUser', () => {
  function getSeedCalls(): string[] {
    return h.mockSqliteEngine.query.mock.calls
      .map((c: unknown[]) => c[0])
      .filter((sql: unknown): sql is string => typeof sql === 'string');
  }

  it('checks for any admin (not a specific email)', async () => {
    h.mockSqliteEngine.query
      .mockResolvedValueOnce({ rows: [{ id: '1', email: 'other@example.com' }], rowCount: 1 }) // existing admin
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // seedSystemUser INSERT
      .mockResolvedValueOnce({ rows: [{ value: 'sqlite' }], rowCount: 1 }); // engine lock

    await reinitialize();

    const selectCall = getSeedCalls().find((sql) => sql.includes('is_admin = TRUE'));
    expect(selectCall).toBeDefined();
    // No admin INSERT should happen because an admin already exists. The
    // system user INSERT (uses ON CONFLICT (id), not RETURNING) is expected.
    const adminInsertCall = getSeedCalls().find(
      (sql) => sql.includes('INSERT INTO users') && sql.includes('RETURNING id'),
    );
    expect(adminInsertCall).toBeUndefined();
  });

  it('inserts with ON CONFLICT (email) DO NOTHING', async () => {
    h.mockSqliteEngine.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // seed SELECT — no admin
      .mockResolvedValueOnce({ rows: [{ id: 'new-admin' }], rowCount: 1 }) // seed INSERT RETURNING
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // seedSystemUser INSERT
      .mockResolvedValueOnce({ rows: [{ value: 'sqlite' }], rowCount: 1 }); // engine lock

    await reinitialize();

    const insertCall = getSeedCalls().find(
      (sql) => sql.includes('INSERT INTO users') && sql.includes('RETURNING id'),
    );
    expect(insertCall).toMatch(/ON CONFLICT\s*\(email\)\s*DO NOTHING/);
    expect(insertCall).toMatch(/RETURNING id/);
  });

  it('rotates the admin password when ADMIN_PASSWORD_RESET=true and ADMIN_PASSWORD set', async () => {
    config.adminPassword = 'new-secret';
    config.adminPasswordReset = true;
    h.mockSqliteEngine.query.mockResolvedValueOnce({
      rows: [{ id: 'existing-id', email: 'admin@example.com' }],
      rowCount: 1,
    });

    await reinitialize();

    const updateCall = h.mockSqliteEngine.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('UPDATE users SET password_hash'),
    );
    expect(updateCall).toBeDefined();
    // UPDATE should target the existing admin id
    expect(updateCall?.[1]).toEqual(['$2b$12$mockhash', 'existing-id']);
  });

  it('ignores ADMIN_PASSWORD_RESET when ADMIN_PASSWORD is unset', async () => {
    config.adminPasswordReset = true;
    h.mockSqliteEngine.query.mockResolvedValueOnce({
      rows: [{ id: 'existing-id', email: 'admin@example.com' }],
      rowCount: 1,
    });

    await reinitialize();

    const updateCall = h.mockSqliteEngine.query.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('UPDATE users SET password_hash'),
    );
    expect(updateCall).toBeUndefined();
  });

  it('still creates an additional admin when ADMIN_RESEED=true', async () => {
    config.adminReseed = true;
    h.mockSqliteEngine.query
      .mockResolvedValueOnce({ rows: [{ id: 'one', email: 'a@b.co' }], rowCount: 1 }) // existing admin
      .mockResolvedValueOnce({ rows: [{ id: 'two' }], rowCount: 1 }) // INSERT RETURNING
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // seedSystemUser INSERT
      .mockResolvedValueOnce({ rows: [{ value: 'sqlite' }], rowCount: 1 }); // engine lock

    await reinitialize();

    const insertCall = getSeedCalls().find(
      (sql) => sql.includes('INSERT INTO users') && sql.includes('RETURNING id'),
    );
    expect(insertCall).toBeDefined();
  });

  it('does not INSERT when admin exists and ADMIN_RESEED is false', async () => {
    config.adminReseed = false;
    h.mockSqliteEngine.query.mockResolvedValueOnce({
      rows: [{ id: 'one', email: 'admin@example.com' }],
      rowCount: 1,
    });

    await reinitialize();

    // The admin INSERT (with RETURNING id) should not happen. The system
    // user INSERT (different shape) is expected and unrelated.
    const adminInsertCall = getSeedCalls().find(
      (sql) => sql.includes('INSERT INTO users') && sql.includes('RETURNING id'),
    );
    expect(adminInsertCall).toBeUndefined();
  });
});
