import { query } from '../db.js';
import { ForbiddenError, NotFoundError, OverLimitError, ValidationError } from './httpErrors.js';
import { checkLocationWritable, generateUpgradeUrl, getEffectiveMemberRole, getUserPlanInfo } from './planGate.js';

export interface BinAccessResult {
  locationId: string;
  visibility: string;
  createdBy: string;
  name: string;
}

export type BinAttachmentKind = 'photo' | 'attachment';

export interface BinAttachmentAccessResult {
  kind: BinAttachmentKind;
  binId: string;
  binName: string;
  locationId: string;
  storagePath: string;
  mimeType: string;
  filename: string;
  createdBy: string;
  role: 'admin' | 'member' | 'viewer';
}

/** Verify user can access a photo or attachment via the photo/attachment → bin → location chain.
 *  Throws NotFoundError if the row doesn't exist, the user isn't a member of the bin's
 *  location, or the bin is private and owned by someone else. Attachments additionally
 *  require the bin to be non-deleted; photos ignore the soft-delete state to preserve
 *  legacy behavior. */
export async function verifyBinAttachmentAccess(
  userId: string,
  resourceId: string,
  kind: BinAttachmentKind,
): Promise<BinAttachmentAccessResult> {
  const table = kind === 'photo' ? 'photos' : 'attachments';
  const notFoundMessage = kind === 'photo' ? 'Photo not found' : 'Attachment not found';
  const deletedFilter = kind === 'attachment' ? ' AND b.deleted_at IS NULL' : '';

  const result = await query<{
    bin_id: string;
    bin_name: string;
    storage_path: string;
    mime_type: string;
    filename: string;
    created_by: string;
    location_id: string;
    visibility: string;
    bin_created_by: string;
    role: 'admin' | 'member' | 'viewer';
  }>(
    `SELECT r.bin_id, b.name AS bin_name, r.storage_path, r.mime_type, r.filename, r.created_by,
            b.location_id, b.visibility, b.created_by AS bin_created_by, lm.role
     FROM ${table} r
     JOIN bins b ON b.id = r.bin_id
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE r.id = $1${deletedFilter}`,
    [resourceId, userId],
  );
  if (result.rows.length === 0) throw new NotFoundError(notFoundMessage);
  const row = result.rows[0];
  if (row.visibility === 'private' && row.bin_created_by !== userId) {
    throw new NotFoundError(notFoundMessage);
  }
  return {
    kind,
    binId: row.bin_id,
    binName: row.bin_name,
    locationId: row.location_id,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    filename: row.filename,
    createdBy: row.created_by,
    role: row.role,
  };
}

/** Verify user is a member of the location that owns a non-deleted bin.
 *  Private bins are only accessible to their creator. */
export async function verifyBinAccess(binId: string, userId: string): Promise<BinAccessResult | null> {
  const result = await query(
    `SELECT b.location_id, b.visibility, b.created_by, b.name FROM bins b
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE b.id = $1 AND b.deleted_at IS NULL`,
    [binId, userId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  // Private bins: only the creator can access
  if (row.visibility === 'private' && row.created_by !== userId) return null;
  return { locationId: row.location_id, visibility: row.visibility, createdBy: row.created_by, name: row.name };
}

/** Verify user is a member of a specific location */
export async function verifyLocationMembership(locationId: string, userId: string): Promise<boolean> {
  const result = await query(
    'SELECT id FROM location_members WHERE location_id = $1 AND user_id = $2',
    [locationId, userId]
  );
  return result.rows.length > 0;
}

/** Verify optional location membership — returns true if no locationId provided. */
export async function verifyOptionalLocationMembership(locationId: string | undefined | null, userId: string): Promise<boolean> {
  if (!locationId) return true;
  return verifyLocationMembership(locationId, userId);
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

/** Throw ForbiddenError if the user is a viewer (or not a member at all) */
export async function requireMemberOrAbove(locationId: string, userId: string, action: string): Promise<void> {
  const role = await getMemberRole(locationId, userId);
  if (!role) {
    throw new ForbiddenError(`Not a member of this location`);
  }

  // Check if location is writable (owner's plan limit)
  const writableCheck = await checkLocationWritable(locationId);
  if (!writableCheck.writable) {
    const planInfo = await getUserPlanInfo(userId);
    const upgradeUrl = planInfo ? await generateUpgradeUrl(userId, planInfo.email) : null;
    throw new OverLimitError(writableCheck.reason ?? 'Location is read-only due to plan limits', upgradeUrl);
  }

  // Use ownerId from writableCheck instead of querying again
  const ownerId = writableCheck.ownerId ?? '';
  const effectiveRole = await getEffectiveMemberRole(userId, locationId, role as 'admin' | 'member' | 'viewer', ownerId);

  if (effectiveRole === 'viewer') {
    throw new ForbiddenError(`Only members and admins can ${action}`);
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

/** Verify that an area belongs to the given location */
export async function verifyAreaInLocation(areaId: string, locationId: string): Promise<void> {
  const result = await query('SELECT id FROM areas WHERE id = $1 AND location_id = $2', [areaId, locationId]);
  if (result.rows.length === 0) throw new ValidationError('Area does not belong to this location');
}
