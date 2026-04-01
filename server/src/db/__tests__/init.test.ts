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

vi.resetModules();

const { initialize, getEngine } = await import('../init.js');
const { config } = await import('../../lib/config.js');
const { setDialect } = await import('../dialect.js');
const { initPostgres, createPostgresEngine } = await import('../postgres.js');

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
  (config as { dbEngine: string }).dbEngine = 'sqlite';
  (config as { databaseUrl: string | null }).databaseUrl = null;
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
    (config as { dbEngine: string }).dbEngine = 'sqlite';

    const engine = await reinitialize();

    expect(engine.dialect).toBe('sqlite');
    expect(setDialect).toHaveBeenCalledWith('sqlite');
  });

  it('selects postgres when config.dbEngine is postgres', async () => {
    (config as { dbEngine: string }).dbEngine = 'postgres';
    (config as { databaseUrl: string | null }).databaseUrl = 'postgres://localhost/test';

    const engine = await reinitialize();

    expect(engine.dialect).toBe('postgres');
    expect(setDialect).toHaveBeenCalledWith('postgres');
  });

  it('is idempotent on second call', async () => {
    (config as { dbEngine: string }).dbEngine = 'sqlite';

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
      .mockResolvedValueOnce({ rows: [{ value: 'postgres' }], rowCount: 1 }); // engine lock — mismatch

    await expect(reinitialize()).rejects.toThrow('Engine mismatch');
  });

  it('passes when engine matches stored value', async () => {
    h.mockSqliteEngine.query
      .mockResolvedValueOnce({ rows: [{ id: '1' }], rowCount: 1 }) // seedAdminUser — admin exists
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
    (config as { dbEngine: string }).dbEngine = 'postgres';
    (config as { databaseUrl: string | null }).databaseUrl = null;

    await expect(reinitialize()).rejects.toThrow('DATABASE_URL is required for PostgreSQL mode');
  });

  it('calls initPostgres with connection string', async () => {
    (config as { dbEngine: string }).dbEngine = 'postgres';
    (config as { databaseUrl: string | null }).databaseUrl = 'postgres://localhost/test';

    await reinitialize();

    expect(initPostgres).toHaveBeenCalledWith('postgres://localhost/test');
  });

  it('attempts pg_trgm extension creation', async () => {
    (config as { dbEngine: string }).dbEngine = 'postgres';
    (config as { databaseUrl: string | null }).databaseUrl = 'postgres://localhost/test';

    await reinitialize();

    expect(h.mockPgPool.query).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  });

  it('warns on pg_trgm failure but continues', async () => {
    (config as { dbEngine: string }).dbEngine = 'postgres';
    (config as { databaseUrl: string | null }).databaseUrl = 'postgres://localhost/test';
    h.mockPgPool.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // SELECT 1
      .mockRejectedValueOnce(new Error('pg_trgm not available')) // CREATE EXTENSION
      .mockResolvedValue({ rows: [] }); // everything else

    // Should not throw
    await reinitialize();

    expect(createPostgresEngine).toHaveBeenCalled();
  });

  it('loads schema in a transaction (BEGIN/COMMIT)', async () => {
    (config as { dbEngine: string }).dbEngine = 'postgres';
    (config as { databaseUrl: string | null }).databaseUrl = 'postgres://localhost/test';

    await reinitialize();

    const calls = h.mockPgPool.query.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain('BEGIN');
    expect(calls).toContain('COMMIT');
  });

  it('rolls back on schema failure', async () => {
    (config as { dbEngine: string }).dbEngine = 'postgres';
    (config as { databaseUrl: string | null }).databaseUrl = 'postgres://localhost/test';

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
