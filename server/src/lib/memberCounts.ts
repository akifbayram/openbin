import { query, type TxQueryFn } from '../db.js';

/**
 * Count members of a location whose role consumes a paid plan slot.
 * Viewers are excluded — they're free and unlimited per the free-viewers
 * pricing model. Use this anywhere you need to compare against
 * `PlanFeatures.maxMembersPerLocation`.
 *
 * Pass `tx` when counting inside a transaction that needs row-level
 * serialization (e.g. join + insert).
 */
export async function countNonViewerMembers(
  locationId: string,
  tx?: TxQueryFn,
): Promise<number> {
  const exec = tx ?? query;
  const result = await exec<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM location_members WHERE location_id = $1 AND role != 'viewer'",
    [locationId],
  );
  return Number(result.rows[0].cnt);
}
