import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Migration } from '../types.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

vi.mock('../../../lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock DB helpers
// ---------------------------------------------------------------------------

let appliedMigrations: string[] = [];

function createMockDb() {
  return {
    exec: vi.fn(),
    prepare: vi.fn((sql: string) => {
      if (sql.includes('SELECT name FROM schema_migrations')) {
        return {
          all: () => appliedMigrations.map((n) => ({ name: n })),
        };
      }
      if (sql.includes('INSERT INTO schema_migrations')) {
        return {
          run: (...args: unknown[]) => {
            appliedMigrations.push(args[0] as string);
          },
        };
      }
      return { all: vi.fn(() => []), run: vi.fn() };
    }),
    transaction: vi.fn((fn: Function) => fn),
  };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { runSqliteMigrations } = await import('../runner.js');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  appliedMigrations = [];
  vi.clearAllMocks();
});

describe('runSqliteMigrations', () => {
  it('creates schema_migrations table', () => {
    const db = createMockDb();
    const migrations: Migration[] = [];

    runSqliteMigrations(db as any, migrations);

    expect(db.exec).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations'),
    );
  });

  it('seeds all migrations as applied when table is empty (bootstrap) — does not call migration functions', () => {
    appliedMigrations = []; // empty table → bootstrap path
    const db = createMockDb();

    const sqliteFn = vi.fn();
    const migrations: Migration[] = [
      { name: '0001_init', sqlite: sqliteFn },
      { name: '0002_add_col', sqlite: sqliteFn },
    ];

    runSqliteMigrations(db as any, migrations);

    // Migration functions should NOT have been called
    expect(sqliteFn).not.toHaveBeenCalled();

    // All migration names should be recorded
    expect(appliedMigrations).toContain('0001_init');
    expect(appliedMigrations).toContain('0002_add_col');
  });

  it('uses a transaction for bootstrap seeding', () => {
    appliedMigrations = [];
    const db = createMockDb();

    const migrations: Migration[] = [{ name: '0001_init', sqlite: vi.fn() }];

    runSqliteMigrations(db as any, migrations);

    expect(db.transaction).toHaveBeenCalled();
  });

  it('runs only pending migrations when some are already applied', () => {
    appliedMigrations = ['0001_init'];
    const db = createMockDb();

    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const migrations: Migration[] = [
      { name: '0001_init', sqlite: fn1 },
      { name: '0002_add_col', sqlite: fn2 },
    ];

    runSqliteMigrations(db as any, migrations);

    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledOnce();
    expect(appliedMigrations).toContain('0002_add_col');
  });

  it('skips migrations with no sqlite function and marks them as applied', () => {
    appliedMigrations = ['0001_init'];
    const db = createMockDb();

    const migrations: Migration[] = [
      { name: '0001_init', sqlite: vi.fn() },
      // 0002 has postgres only — no sqlite fn
      { name: '0002_postgres_only', postgres: async () => {} },
    ];

    runSqliteMigrations(db as any, migrations);

    expect(appliedMigrations).toContain('0002_postgres_only');
  });

  it('stops and throws on migration failure, does not mark failed migration as applied', () => {
    appliedMigrations = ['0001_init'];
    const db = createMockDb();

    const failingFn = vi.fn(() => {
      throw new Error('migration broke');
    });
    const afterFn = vi.fn();

    const migrations: Migration[] = [
      { name: '0001_init', sqlite: vi.fn() },
      { name: '0002_bad', sqlite: failingFn },
      { name: '0003_after', sqlite: afterFn },
    ];

    expect(() => runSqliteMigrations(db as any, migrations)).toThrow('migration broke');

    // Failed migration should NOT be recorded
    expect(appliedMigrations).not.toContain('0002_bad');
    // Migration after the failed one should not have run
    expect(afterFn).not.toHaveBeenCalled();
  });

  it('records a successful migration after running it', () => {
    appliedMigrations = ['0001_init'];
    const db = createMockDb();

    const fn = vi.fn();
    const migrations: Migration[] = [
      { name: '0001_init', sqlite: vi.fn() },
      { name: '0002_new', sqlite: fn },
    ];

    runSqliteMigrations(db as any, migrations);

    expect(fn).toHaveBeenCalledOnce();
    expect(appliedMigrations).toContain('0002_new');
  });
});
