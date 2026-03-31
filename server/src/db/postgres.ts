import pg from 'pg';
import { deserializeRow } from './shared.js';
import type { DatabaseEngine, QueryResult, TxQueryFn } from './types.js';

const { Pool, types } = pg;

// PostgreSQL bigint (OID 20) → JavaScript number (safe for COUNT(*) values)
types.setTypeParser(20, (val: string) => Number(val));

/** Auto-serialize arrays to JSON strings in params */
function serializeParams(params?: unknown[]): unknown[] {
  if (!params) return [];
  return params.map(v => Array.isArray(v) ? JSON.stringify(v) : v);
}

let pool: pg.Pool | null = null;

export function initPostgres(connectionString: string): pg.Pool {
  pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) throw new Error('PostgreSQL not initialized');
  return pool;
}

export function createPostgresEngine(): DatabaseEngine {
  if (!pool) throw new Error('PostgreSQL not initialized — call initPostgres() first');

  return {
    dialect: 'postgres' as const,

    async query<T>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
      const result = await pool!.query(text, serializeParams(params));
      const rows = (result.rows ?? []).map(r => deserializeRow<T>(r));
      return { rows, rowCount: result.rowCount ?? 0 };
    },

    querySync<T>(_text: string, _params?: unknown[]): QueryResult<T> {
      throw new Error('querySync() is not available in PostgreSQL mode. Use query() instead.');
    },

    async withTransaction<T>(fn: (query: TxQueryFn) => Promise<T>): Promise<T> {
      const client = await pool!.connect();
      try {
        await client.query('BEGIN');
        const txQuery: TxQueryFn = async <R = Record<string, any>>(
          sql: string,
          params?: unknown[],
        ): Promise<QueryResult<R>> => {
          const result = await client.query(sql, serializeParams(params));
          const rows = (result.rows ?? []).map(r => deserializeRow<R>(r));
          return { rows, rowCount: result.rowCount ?? 0 };
        };
        const result = await fn(txQuery);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async close(): Promise<void> {
      await pool?.end();
      pool = null;
    },
  };
}
