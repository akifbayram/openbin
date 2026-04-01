import { afterAll, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the init module to control the engine returned by getEngine()
// ---------------------------------------------------------------------------

const mockEngine = vi.hoisted(() => ({
  query: vi.fn(),
  querySync: vi.fn(),
  withTransaction: vi.fn(),
  close: vi.fn(),
  dialect: 'postgres' as const,
}));

vi.mock('../init.js', () => ({
  getEngine: () => mockEngine,
  initialize: vi.fn(),
}));

vi.mock('../dialect.js', () => ({
  getDialect: vi.fn(() => 'postgres'),
  setDialect: vi.fn(),
  d: {},
}));

vi.mock('../sqlite.js', () => ({
  getSqliteDb: vi.fn(() => {
    throw new Error('Not in SQLite mode');
  }),
}));

vi.resetModules();
const { query, querySync, withTransaction, getDb, generateUuid } = await import('../../db.js');

afterAll(async () => {
  vi.restoreAllMocks();
  vi.resetModules();
  const { initialize } = await import('../init.js');
  try { await initialize(); } catch { /* best-effort */ }
});

// ---------------------------------------------------------------------------
// query
// ---------------------------------------------------------------------------

describe('query', () => {
  it('delegates to engine.query()', async () => {
    mockEngine.query.mockResolvedValue({ rows: [{ id: '1' }], rowCount: 1 });

    const result = await query('SELECT $1', ['test']);

    expect(mockEngine.query).toHaveBeenCalledWith('SELECT $1', ['test']);
    expect(result).toEqual({ rows: [{ id: '1' }], rowCount: 1 });
  });
});

// ---------------------------------------------------------------------------
// querySync
// ---------------------------------------------------------------------------

describe('querySync', () => {
  it('delegates to engine.querySync()', () => {
    mockEngine.querySync.mockReturnValue({ rows: [], rowCount: 0 });

    const result = querySync('SELECT 1');

    expect(mockEngine.querySync).toHaveBeenCalledWith('SELECT 1', undefined);
    expect(result).toEqual({ rows: [], rowCount: 0 });
  });
});

// ---------------------------------------------------------------------------
// withTransaction
// ---------------------------------------------------------------------------

describe('withTransaction', () => {
  it('delegates to engine.withTransaction()', async () => {
    const fn = vi.fn().mockResolvedValue('tx-result');
    mockEngine.withTransaction.mockImplementation(
      async (cb: (q: unknown) => Promise<unknown>) => cb('txQuery'),
    );

    const result = await withTransaction(fn);

    expect(mockEngine.withTransaction).toHaveBeenCalled();
    expect(fn).toHaveBeenCalledWith('txQuery');
    expect(result).toBe('tx-result');
  });
});

// ---------------------------------------------------------------------------
// getDb
// ---------------------------------------------------------------------------

describe('getDb', () => {
  it('throws when dialect is postgres', () => {
    expect(() => getDb()).toThrow('getDb() is only available in SQLite mode.');
  });
});

// ---------------------------------------------------------------------------
// generateUuid
// ---------------------------------------------------------------------------

describe('generateUuid', () => {
  it('returns a valid UUID format', () => {
    const uuid = generateUuid();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('returns unique values on successive calls', () => {
    const a = generateUuid();
    const b = generateUuid();
    expect(a).not.toBe(b);
  });
});
