import { query } from '../db.js';
import { ForbiddenError, ValidationError } from './httpErrors.js';

/** Verify user is a member of the location that owns a non-deleted bin.
 *  Private bins are only accessible to their creator. */
export async function verifyBinAccess(binId: string, userId: string): Promise<{ locationId: string; visibility: string; createdBy: string } | null> {
  const result = await query(
    `SELECT b.location_id, b.visibility, b.created_by FROM bins b
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE b.id = $1 AND b.deleted_at IS NULL`,
    [binId, userId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  // Private bins: only the creator can access
  if (row.visibility === 'private' && row.created_by !== userId) return null;
  return { locationId: row.location_id, visibility: row.visibility, createdBy: row.created_by };
}

/** Verify user is a member of a specific location */
export async function verifyLocationMembership(locationId: string, userId: string): Promise<boolean> {
  const result = await query(
    'SELECT id FROM location_members WHERE location_id = $1 AND user_id = $2',
    [locationId, userId]
  );
  return result.rows.length > 0;
}

/** Get the role of a user in a location, or null if not a member */
export async function getMemberRole(locationId: string, userId: string): Promise<string | null> {
  const result = await query(
    'SELECT role FROM location_members WHERE location_id = $1 AND user_id = $2',
    [locationId, userId]
  );
  return result.rows.length > 0 ? result.rows[0].role : null;
}

/** Check if a user is an admin of a location */
export async function isLocationAdmin(locationId: string, userId: string): Promise<boolean> {
  return (await getMemberRole(locationId, userId)) === 'admin';
}

/** Throw ForbiddenError if the user is not an admin of the location */
export async function requireAdmin(locationId: string, userId: string, action: string): Promise<void> {
  const role = await getMemberRole(locationId, userId);
  if (role !== 'admin') {
    throw new ForbiddenError(`Only admins can ${action}`);
  }
}

/** Verify user has access to a soft-deleted bin (visibility-aware). */
export async function verifyDeletedBinAccess(
  binId: string,
  userId: string,
): Promise<{ locationId: string; name: string } | null> {
  const result = await query(
    `SELECT b.location_id, b.name FROM bins b
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE b.id = $1 AND b.deleted_at IS NOT NULL AND (b.visibility = 'location' OR b.created_by = $2)`,
    [binId, userId]
  );
  if (result.rows.length === 0) return null;
  return { locationId: result.rows[0].location_id, name: result.rows[0].name };
}

/** Check if a user created a specific bin */
export async function isBinCreator(binId: string, userId: string): Promise<boolean> {
  const result = await query(
    'SELECT id FROM bins WHERE id = $1 AND created_by = $2',
    [binId, userId]
  );
  return result.rows.length > 0;
}

/** Verify that an area belongs to the given location */
export async function verifyAreaInLocation(areaId: string, locationId: string): Promise<void> {
  const result = await query('SELECT id FROM areas WHERE id = $1 AND location_id = $2', [areaId, locationId]);
  if (result.rows.length === 0) throw new ValidationError('Area does not belong to this location');
}
