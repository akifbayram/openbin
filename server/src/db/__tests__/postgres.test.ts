import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock setup — vi.hoisted runs before vi.mock factory
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const mockClientQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockConnect = vi.fn();
  const mockEnd = vi.fn();
  const mockPoolQuery = vi.fn();
  // Must be a regular function (not arrow) so it can be called with `new`
  const MockPool = vi.fn(() => ({
      query: mockPoolQuery,
      connect: mockConnect,
      end: mockEnd,
    }));
  return { mockClientQuery, mockRelease, mockConnect, mockEnd, mockPoolQuery, MockPool };
});

vi.mock('pg', () => ({
  default: {
    Pool: mocks.MockPool,
    types: { setTypeParser: vi.fn() },
  },
  Pool: mocks.MockPool,
  types: { setTypeParser: vi.fn() },
}));

// Force fresh module load so postgres.ts picks up the mocked pg
vi.resetModules();
const { initPostgres, getPool, createPostgresEngine } = await import('../postgres.js');

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockConnect.mockResolvedValue({
    query: mocks.mockClientQuery,
    release: mocks.mockRelease,
  });
  mocks.mockEnd.mockResolvedValue(undefined);
});

afterEach(async () => {
  try {
    const engine = createPostgresEngine();
    await engine.close();
  } catch {
    // pool may already be null
  }
});

// Restore modules so the global setup's afterAll can find its engine
afterAll(async () => {
  vi.restoreAllMocks();
  vi.resetModules();
  const { initialize } = await import('../init.js');
  try { await initialize(); } catch { /* best-effort */ }
});

// ---------------------------------------------------------------------------
// getPool
// ---------------------------------------------------------------------------

describe('getPool', () => {
  it('throws before initPostgres is called', () => {
    expect(() => getPool()).toThrow('PostgreSQL not initialized');
  });

  it('returns pool after initPostgres', () => {
    initPostgres('postgres://localhost/test');
    const pool = getPool();
    expect(pool).toBeDefined();
    expect(pool.query).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// createPostgresEngine
// ---------------------------------------------------------------------------

describe('createPostgresEngine', () => {
  it('throws before initPostgres is called', () => {
    expect(() => createPostgresEngine()).toThrow(
      'PostgreSQL not initialized — call initPostgres() first',
    );
  });

  it('returns engine with correct dialect', () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    expect(engine.dialect).toBe('postgres');
  });

  it('returns engine with all required methods', () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    expect(typeof engine.query).toBe('function');
    expect(typeof engine.querySync).toBe('function');
    expect(typeof engine.withTransaction).toBe('function');
    expect(typeof engine.close).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// initPostgres
// ---------------------------------------------------------------------------

describe('initPostgres', () => {
  it('creates Pool with correct config', () => {
    initPostgres('postgres://localhost/test');
    expect(mocks.MockPool).toHaveBeenCalledWith({
      connectionString: 'postgres://localhost/test',
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  });
});

// ---------------------------------------------------------------------------
// query (also tests serializeParams indirectly)
// ---------------------------------------------------------------------------

describe('query', () => {
  it('serializes array params to JSON strings', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await engine.query('SELECT $1', [['a', 'b']]);
    expect(mocks.mockPoolQuery).toHaveBeenCalledWith('SELECT $1', ['["a","b"]']);
  });

  it('passes through non-array params unchanged', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await engine.query('SELECT $1, $2, $3', [1, 'hello', true]);
    expect(mocks.mockPoolQuery).toHaveBeenCalledWith('SELECT $1, $2, $3', [1, 'hello', true]);
  });

  it('passes empty array when no params provided', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await engine.query('SELECT 1');
    expect(mocks.mockPoolQuery).toHaveBeenCalledWith('SELECT 1', []);
  });

  it('preserves null in params', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await engine.query('INSERT INTO t (a) VALUES ($1)', [null]);
    expect(mocks.mockPoolQuery).toHaveBeenCalledWith('INSERT INTO t (a) VALUES ($1)', [null]);
  });

  it('serializes nested arrays', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await engine.query('SELECT $1', [[1, [2, 3]]]);
    expect(mocks.mockPoolQuery).toHaveBeenCalledWith('SELECT $1', ['[1,[2,3]]']);
  });

  it('maps rows through deserializeRow', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockPoolQuery.mockResolvedValue({
      rows: [{ id: '1', tags: '["x"]' }],
      rowCount: 1,
    });

    const result = await engine.query('SELECT * FROM bins');
    expect(result.rows[0]).toEqual({ id: '1', tags: ['x'] });
  });

  it('handles null rows from pg result', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockPoolQuery.mockResolvedValue({ rows: null, rowCount: 0 });

    const result = await engine.query('DELETE FROM bins');
    expect(result.rows).toEqual([]);
  });

  it('handles null rowCount from pg result', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockPoolQuery.mockResolvedValue({ rows: [], rowCount: null });

    const result = await engine.query('SELECT 1');
    expect(result.rowCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// querySync
// ---------------------------------------------------------------------------

describe('querySync', () => {
  it('throws with correct error message', () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    expect(() => engine.querySync('SELECT 1')).toThrow(
      'querySync() is not available in PostgreSQL mode. Use query() instead.',
    );
  });
});

// ---------------------------------------------------------------------------
// close
// ---------------------------------------------------------------------------

describe('close', () => {
  it('calls pool.end()', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    await engine.close();
    expect(mocks.mockEnd).toHaveBeenCalled();
  });

  it('safe to call when pool is already null', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    await engine.close();
    await engine.close();
  });
});

// ---------------------------------------------------------------------------
// withTransaction
// ---------------------------------------------------------------------------

describe('withTransaction', () => {
  it('executes BEGIN, callback, COMMIT flow', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockClientQuery.mockResolvedValue({ rows: [{ id: '1' }], rowCount: 1 });

    const result = await engine.withTransaction(async (txQuery) => {
      const r = await txQuery('SELECT 1');
      return r.rows;
    });

    expect(mocks.mockConnect).toHaveBeenCalled();
    expect(mocks.mockClientQuery).toHaveBeenCalledWith('BEGIN');
    expect(mocks.mockClientQuery).toHaveBeenCalledWith('COMMIT');
    expect(mocks.mockRelease).toHaveBeenCalled();
    expect(result).toEqual([{ id: '1' }]);
  });

  it('issues ROLLBACK on callback error', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(
      engine.withTransaction(async () => {
        throw new Error('tx failure');
      }),
    ).rejects.toThrow('tx failure');

    expect(mocks.mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(mocks.mockRelease).toHaveBeenCalled();
  });

  it('releases client even on error', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    try {
      await engine.withTransaction(async () => {
        throw new Error('fail');
      });
    } catch {
      // expected
    }

    expect(mocks.mockRelease).toHaveBeenCalledTimes(1);
  });

  it('txQuery serializes array params', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await engine.withTransaction(async (txQuery) => {
      await txQuery('INSERT INTO bins (tags) VALUES ($1)', [['a', 'b']]);
    });

    expect(mocks.mockClientQuery).toHaveBeenCalledWith(
      'INSERT INTO bins (tags) VALUES ($1)',
      ['["a","b"]'],
    );
  });

  it('txQuery maps rows through deserializeRow', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockClientQuery.mockResolvedValue({ rows: [{ items: '["x"]' }], rowCount: 1 });

    let resultRows: unknown[] = [];
    await engine.withTransaction(async (txQuery) => {
      const r = await txQuery('SELECT items FROM bins');
      resultRows = r.rows;
    });

    expect(resultRows).toEqual([{ items: ['x'] }]);
  });

  it('txQuery handles null rows and rowCount', async () => {
    initPostgres('postgres://localhost/test');
    const engine = createPostgresEngine();
    mocks.mockClientQuery.mockResolvedValue({ rows: null, rowCount: null });

    let result: { rows: unknown[]; rowCount: number } | undefined;
    await engine.withTransaction(async (txQuery) => {
      result = await txQuery('DELETE FROM bins');
    });

    expect(result!.rows).toEqual([]);
    expect(result!.rowCount).toBe(0);
  });
});
