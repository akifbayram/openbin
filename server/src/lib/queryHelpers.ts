import { query } from '../db.js';
import { NotFoundError } from './httpErrors.js';

/**
 * Run a query and return the first row, or throw NotFoundError if no rows.
 */
export async function queryOne<T = Record<string, any>>(
  sql: string,
  params: unknown[],
  notFoundMessage: string,
): Promise<T> {
  const result = await query<T>(sql, params);
  if (result.rows.length === 0) throw new NotFoundError(notFoundMessage);
  return result.rows[0];
}

/**
 * Return the first row or null (no throw). For optional lookups.
 */
export async function queryMaybeOne<T = Record<string, any>>(
  sql: string,
  params: unknown[],
): Promise<T | null> {
  const result = await query<T>(sql, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}
