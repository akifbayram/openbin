import crypto from 'node:crypto';
import { getDialect } from './db/dialect.js';
import { getEngine } from './db/init.js';
import { getSqliteDb } from './db/sqlite.js';
import type { QueryResult, TxQueryFn } from './db/types.js';

export type { QueryResult, TxQueryFn };
export { d, getDialect } from './db/dialect.js';
export { initialize } from './db/init.js';

export async function query<T = Record<string, any>>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getEngine().query<T>(text, params);
}

export function querySync<T = Record<string, any>>(
  text: string,
  params?: unknown[],
): QueryResult<T> {
  return getEngine().querySync<T>(text, params);
}

export async function withTransaction<T>(
  fn: (query: TxQueryFn) => Promise<T>,
): Promise<T> {
  return getEngine().withTransaction(fn);
}

/** @deprecated Use query() or withTransaction() instead. SQLite only. */
export function getDb(): import('better-sqlite3').Database {
  if (getDialect() !== 'sqlite') {
    throw new Error('getDb() is only available in SQLite mode.');
  }
  return getSqliteDb();
}

export function generateUuid(): string {
  return crypto.randomUUID();
}
