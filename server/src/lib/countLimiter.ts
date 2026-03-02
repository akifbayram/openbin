import { query } from '../db.js';
import { ValidationError } from './httpErrors.js';

type CountTable = 'api_keys' | 'saved_views';

const TABLE_QUERIES: Record<CountTable, string> = {
  api_keys: 'SELECT COUNT(*) AS cnt FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL',
  saved_views: 'SELECT COUNT(*) AS cnt FROM saved_views WHERE user_id = $1',
};

/**
 * Throws a ValidationError if the count of matching rows meets or exceeds `maxCount`.
 * Call before INSERT to enforce per-user / per-resource limits.
 */
export async function enforceCountLimit(
  table: CountTable,
  userId: string,
  maxCount: number,
  resourceName: string,
): Promise<void> {
  const result = await query<{ cnt: number }>(TABLE_QUERIES[table], [userId]);
  if (result.rows[0].cnt >= maxCount) {
    throw new ValidationError(`Maximum ${maxCount} ${resourceName} allowed`);
  }
}
