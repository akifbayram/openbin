import { query } from '../db.js';
import { ValidationError } from './httpErrors.js';

/**
 * Throws a ValidationError if the count of matching rows meets or exceeds `maxCount`.
 * Call before INSERT to enforce per-user / per-resource limits.
 */
export async function enforceCountLimit(
  table: string,
  whereClause: string,
  whereParams: unknown[],
  maxCount: number,
  resourceName: string,
): Promise<void> {
  const countResult = await query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${whereClause}`,
    whereParams,
  );
  if (countResult.rows[0].cnt >= maxCount) {
    throw new ValidationError(`Maximum ${maxCount} ${resourceName} allowed`);
  }
}
