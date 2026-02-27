import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { query, getDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logActivity } from '../lib/activityLog.js';
import { purgeExpiredTrash } from '../lib/trashPurge.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../lib/httpErrors.js';
import { validateBinName } from '../lib/validation.js';
import { binPhotoUpload } from '../lib/uploadConfig.js';
import { verifyBinAccess, verifyLocationMembership, getMemberRole, isBinCreator, verifyAreaInLocation, requireAdmin, verifyDeletedBinAccess } from '../lib/binAccess.js';
import { BIN_SELECT_COLS, buildBinListQuery, fetchBinById } from '../lib/binQueries.js';
import { validateBinFields } from '../lib/binValidation.js';
import { buildBinSetClauses, replaceBinItems, insertBinWithItems, buildBinUpdateDiff } from '../lib/binUpdateHelpers.js';
import { cleanupBinPhotos } from '../lib/photoCleanup.js';
import { generateThumbnail } from '../lib/photoHelpers.js';

const router = Router();

/** Thin wrapper: fills auth context from req and sets entityType to 'bin'. */
function logBinActivity(
  req: Express.Request,
  opts: { locationId: string; action: string; entityId?: string; entityName?: string; changes?: Record<string, { old: unknown; new: unknown }> },
): void {
  logActivity({
    ...opts,
    entityType: 'bin',
    userId: req.user!.id,
    userName: req.user!.username,
    authMethod: req.authMethod,
    apiKeyId: req.apiKeyId,
  });
}

router.use(authenticate);

// POST /api/bins — create bin
router.post('/', asyncHandler(async (req, res) => {
  const { locationId, name, areaId, items, notes, tags, icon, color, visibility, cardStyle } = req.body;

  if (!locationId) {
    throw new ValidationError('locationId is required');
  }

  validateBinName(name);
  validateBinFields({ items, tags, notes, icon, color, cardStyle, visibility });

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  if (areaId) await verifyAreaInLocation(areaId, locationId);

  const bin = await insertBinWithItems({
    locationId,
    name,
    areaId: areaId || null,
    notes: notes || '',
    tags: tags || [],
    icon: icon || '',
    color: color || '',
    cardStyle: cardStyle || '',
    createdBy: req.user!.id,
    visibility: visibility || 'location',
    items: Array.isArray(items) ? items : [],
  });

  logBinActivity(req, { locationId, action: 'create', entityId: bin.id, entityName: bin.name });

  res.status(201).json(bin);
}));

// GET /api/bins — list all (non-deleted) bins for a location
// Optional query params: q, tag, tags, tag_mode, area_id, areas, colors,
//   has_items, has_notes, needs_organizing, sort, sort_dir, limit, offset
router.get('/', asyncHandler(async (req, res) => {
  const locationId = req.query.location_id as string | undefined;

  if (!locationId) {
    throw new ValidationError('location_id query parameter is required');
  }

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  // Pagination params
  const limitRaw = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
  const limit = limitRaw !== undefined && !Number.isNaN(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : undefined;
  const offset = limit !== undefined ? Math.max(0, Number(req.query.offset) || 0) : 0;

  const { whereSQL, orderClause, params } = buildBinListQuery({
    locationId,
    userId: req.user!.id,
    q: req.query.q as string | undefined,
    tag: req.query.tag as string | undefined,
    tags: req.query.tags as string | undefined,
    tagMode: (req.query.tag_mode as string | undefined) === 'all' ? 'all' : 'any',
    areaId: req.query.area_id as string | undefined,
    areas: req.query.areas as string | undefined,
    colors: req.query.colors as string | undefined,
    hasItems: req.query.has_items as string | undefined,
    hasNotes: req.query.has_notes as string | undefined,
    needsOrganizing: req.query.needs_organizing as string | undefined,
    sort: req.query.sort as string | undefined,
    sortDir: req.query.sort_dir as string | undefined,
  });

  // When limit is provided, run a count query and apply LIMIT/OFFSET
  if (limit !== undefined) {
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM bins b LEFT JOIN areas a ON a.id = b.area_id WHERE ${whereSQL}`,
      params
    );
    const total = (countResult.rows[0] as { total: number }).total;

    const result = await query(
      `SELECT ${BIN_SELECT_COLS}, CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2
       WHERE ${whereSQL} ORDER BY ${orderClause} LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({ results: result.rows, count: total });
  } else {
    const result = await query(
      `SELECT ${BIN_SELECT_COLS}, CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2
       WHERE ${whereSQL} ORDER BY ${orderClause}`,
      params
    );

    res.json({ results: result.rows, count: result.rows.length });
  }
}));

// GET /api/bins/trash — list soft-deleted bins for a location
router.get('/trash', asyncHandler(async (req, res) => {
  const locationId = req.query.location_id as string | undefined;

  if (!locationId) {
    throw new ValidationError('location_id query parameter is required');
  }

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  // Fire-and-forget: purge bins past retention period
  purgeExpiredTrash(locationId).catch(() => {});

  const result = await query(
    `SELECT ${BIN_SELECT_COLS}, b.deleted_at
     FROM bins b LEFT JOIN areas a ON a.id = b.area_id
     WHERE b.location_id = $1 AND b.deleted_at IS NOT NULL AND (b.visibility = 'location' OR b.created_by = $2) ORDER BY b.deleted_at DESC`,
    [locationId, req.user!.id]
  );

  res.json({ results: result.rows, count: result.rows.length });
}));

// GET /api/bins/lookup/:shortCode — lookup bin by short code (alias for GET /api/bins/:id)
router.get('/lookup/:shortCode', asyncHandler(async (req, res) => {
  const code = req.params.shortCode.toUpperCase();

  const result = await query(
    `SELECT ${BIN_SELECT_COLS}, CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
     FROM bins b
     LEFT JOIN areas a ON a.id = b.area_id
     LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE UPPER(b.id) = $1 AND b.deleted_at IS NULL AND (b.visibility = 'location' OR b.created_by = $2)`,
    [code, req.user!.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Bin not found');
  }

  res.json(result.rows[0]);
}));

// GET /api/bins/pinned — list pinned bins for current user
router.get('/pinned', asyncHandler(async (req, res) => {
  const locationId = req.query.location_id as string | undefined;
  if (!locationId) {
    throw new ValidationError('location_id query parameter is required');
  }
  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }
  const result = await query(
    `SELECT ${BIN_SELECT_COLS}, 1 AS is_pinned
     FROM pinned_bins pb
     JOIN bins b ON b.id = pb.bin_id
     LEFT JOIN areas a ON a.id = b.area_id
     WHERE pb.user_id = $1 AND b.location_id = $2 AND b.deleted_at IS NULL AND (b.visibility = 'location' OR b.created_by = $1)
     ORDER BY pb.position`,
    [req.user!.id, locationId]
  );
  res.json({ results: result.rows, count: result.rows.length });
}));

// PUT /api/bins/pinned/reorder — update pin positions
router.put('/pinned/reorder', asyncHandler(async (req, res) => {
  const { bin_ids } = req.body;
  if (!Array.isArray(bin_ids) || bin_ids.length === 0) {
    throw new ValidationError('bin_ids array is required');
  }
  const db = getDb();
  const stmt = db.prepare('UPDATE pinned_bins SET position = ? WHERE user_id = ? AND bin_id = ?');
  const updateAll = db.transaction(() => {
    for (let i = 0; i < bin_ids.length; i++) {
      stmt.run(i, req.user!.id, bin_ids[i]);
    }
  });
  updateAll();
  res.json({ success: true });
}));

// GET /api/bins/:id — get single bin
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  const bin = await fetchBinById(id, { userId: req.user!.id, excludeDeleted: true });
  if (!bin) {
    throw new NotFoundError('Bin not found');
  }

  res.json(bin);
}));

// PUT /api/bins/:id — update bin
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  // Members can only edit bins they created; admins can edit any bin
  const role = await getMemberRole(access.locationId, req.user!.id);
  if (role === 'member' && !await isBinCreator(id, req.user!.id)) {
    throw new ForbiddenError('Only admins or the bin creator can edit this bin');
  }

  const { name, areaId, items, notes, tags, icon, color, cardStyle, visibility } = req.body;

  if (name !== undefined) {
    validateBinName(name);
  }
  validateBinFields({ items, tags, notes, icon, color, cardStyle, visibility });
  if (visibility === 'private' && access.createdBy !== req.user!.id) {
    throw new ForbiddenError('Only the bin creator can set visibility to private');
  }

  // Fetch old state for activity log diff
  const oldResult = await query(
    'SELECT name, area_id, notes, tags, icon, color, card_style, visibility FROM bins WHERE id = $1',
    [id]
  );
  const oldBin = oldResult.rows[0];

  if (areaId !== undefined && areaId) {
    await verifyAreaInLocation(areaId, access.locationId);
  }

  const { setClauses, params, nextParamIdx } = buildBinSetClauses({ name, areaId, notes, tags, icon, color, cardStyle, visibility });
  params.push(id);

  await query(
    `UPDATE bins SET ${setClauses.join(', ')} WHERE id = $${nextParamIdx} AND deleted_at IS NULL`,
    params
  );

  // Handle items separately — full replacement
  const itemChanges = items !== undefined && Array.isArray(items)
    ? await replaceBinItems(id, items)
    : null;

  // Re-fetch with BIN_SELECT_COLS
  const bin = await fetchBinById(id, { userId: req.user!.id, excludeDeleted: true });
  if (!bin) {
    throw new NotFoundError('Bin not found');
  }

  if (oldBin) {
    const changes = await buildBinUpdateDiff(
      oldBin,
      { name, areaId, notes, tags, icon, color, cardStyle, visibility },
      itemChanges,
    );
    if (changes) {
      logBinActivity(req, { locationId: access.locationId, action: 'update', entityId: id, entityName: bin.name, changes });
    }
  }

  res.json(bin);
}));

// DELETE /api/bins/:id — soft-delete bin (admin only)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  await requireAdmin(access.locationId, req.user!.id, 'delete bins');

  // Fetch bin before soft-deleting for response
  const bin = await fetchBinById(id, { excludeDeleted: true });
  if (!bin) {
    throw new NotFoundError('Bin not found');
  }

  // Soft delete
  await query("UPDATE bins SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = $1", [id]);

  logBinActivity(req, { locationId: access.locationId, action: 'delete', entityId: id, entityName: bin.name });

  res.json(bin);
}));

// POST /api/bins/:id/restore — restore a soft-deleted bin (admin only)
router.post('/:id/restore', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deletedAccess = await verifyDeletedBinAccess(id, req.user!.id);
  if (!deletedAccess) {
    throw new NotFoundError('Deleted bin not found');
  }

  const { locationId } = deletedAccess;
  await requireAdmin(locationId, req.user!.id, 'restore bins');

  await query(
    `UPDATE bins SET deleted_at = NULL, updated_at = datetime('now') WHERE id = $1`,
    [id]
  );

  const bin = (await fetchBinById(id))!;

  logBinActivity(req, { locationId, action: 'restore', entityId: id, entityName: bin.name });

  res.json(bin);
}));

// DELETE /api/bins/:id/permanent — permanently delete a soft-deleted bin (admin only)
router.delete('/:id/permanent', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deletedAccess = await verifyDeletedBinAccess(id, req.user!.id);
  if (!deletedAccess) {
    throw new NotFoundError('Deleted bin not found');
  }

  const { locationId, name: binName } = deletedAccess;
  await requireAdmin(locationId, req.user!.id, 'permanently delete bins');

  // Get photos to delete from disk
  const photosResult = await query<{ storage_path: string; thumb_path: string | null }>(
    'SELECT storage_path, thumb_path FROM photos WHERE bin_id = $1',
    [id]
  );

  // Hard delete (cascades to photos in DB)
  await query('DELETE FROM bins WHERE id = $1', [id]);

  cleanupBinPhotos(id, photosResult.rows);

  logBinActivity(req, { locationId, action: 'permanent_delete', entityId: id, entityName: binName });

  res.json({ message: 'Bin permanently deleted' });
}));

// POST /api/bins/:id/photos — upload photo for a bin
router.post('/:id/photos', asyncHandler(async (req, res, next) => {
  // Validate bin access before multer writes file to disk
  const binId = req.params.id;
  const access = await verifyBinAccess(binId, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }
  next();
}), binPhotoUpload.single('photo'), asyncHandler(async (req, res) => {
  const binId = req.params.id;
  const file = req.file;

  if (!file) {
    throw new ValidationError('No photo uploaded');
  }

  const access = await verifyBinAccess(binId, req.user!.id);
  if (!access) {
    fs.unlinkSync(file.path);
    throw new NotFoundError('Bin not found');
  }

  const storagePath = path.join(binId, file.filename);
  const photoId = crypto.randomUUID();

  // Generate thumbnail
  let thumbPath: string | null = null;
  try {
    const thumbFilename = `${path.basename(file.filename, path.extname(file.filename))}_thumb.webp`;
    const thumbFullPath = path.join(path.dirname(file.path), thumbFilename);
    await generateThumbnail(file.path, thumbFullPath);
    thumbPath = path.join(binId, thumbFilename);
  } catch {
    // Thumbnail generation is non-critical
  }

  const result = await query(
    `INSERT INTO photos (id, bin_id, filename, mime_type, size, storage_path, thumb_path, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, bin_id, filename, mime_type, size, storage_path, thumb_path, created_by, created_at`,
    [photoId, binId, path.basename(file.originalname).slice(0, 255), file.mimetype, file.size, storagePath, thumbPath, req.user!.id]
  );

  await query("UPDATE bins SET updated_at = datetime('now') WHERE id = $1", [binId]);

  const photo = result.rows[0];

  // Get bin name for activity log
  const binResult = await query('SELECT name FROM bins WHERE id = $1', [binId]);
  logBinActivity(req, { locationId: access.locationId, action: 'add_photo', entityId: binId, entityName: binResult.rows[0]?.name });

  res.status(201).json({ id: photo.id });
}));

// POST /api/bins/:id/pin — pin a bin
router.post('/:id/pin', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  // Check pin count limit per location
  const countResult = await query(
    `SELECT COUNT(*) as cnt FROM pinned_bins pb
     JOIN bins b ON b.id = pb.bin_id
     WHERE pb.user_id = $1 AND b.location_id = $2`,
    [req.user!.id, access.locationId]
  );
  if (countResult.rows[0].cnt >= 20) {
    throw new ValidationError('Maximum 20 pinned bins per location');
  }

  // Get max position
  const maxResult = await query(
    'SELECT COALESCE(MAX(position), -1) as max_pos FROM pinned_bins WHERE user_id = $1',
    [req.user!.id]
  );
  const nextPos = maxResult.rows[0].max_pos + 1;

  await query(
    'INSERT OR IGNORE INTO pinned_bins (user_id, bin_id, position) VALUES ($1, $2, $3)',
    [req.user!.id, id, nextPos]
  );

  res.json({ pinned: true });
}));

// DELETE /api/bins/:id/pin — unpin a bin
router.delete('/:id/pin', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query(
    'DELETE FROM pinned_bins WHERE user_id = $1 AND bin_id = $2',
    [req.user!.id, id]
  );
  res.json({ pinned: false });
}));

// POST /api/bins/:id/move — move bin to a different location (admin only)
router.post('/:id/move', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { locationId: targetLocationId } = req.body;

  if (!targetLocationId) {
    throw new ValidationError('locationId is required');
  }

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  await requireAdmin(access.locationId, req.user!.id, 'move bins');

  if (access.locationId === targetLocationId) {
    throw new ValidationError('Bin is already in this location');
  }

  if (!await verifyLocationMembership(targetLocationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of target location');
  }

  // Get location names for activity log
  const sourceLocResult = await query<{ name: string }>('SELECT name FROM locations WHERE id = $1', [access.locationId]);
  const targetLocResult = await query<{ name: string }>('SELECT name FROM locations WHERE id = $1', [targetLocationId]);
  const sourceName = sourceLocResult.rows[0]?.name ?? '';
  const targetName = targetLocResult.rows[0]?.name ?? '';

  // Move bin: update location, clear area (areas are location-scoped)
  await query(
    `UPDATE bins SET location_id = $1, area_id = NULL, updated_at = datetime('now') WHERE id = $2`,
    [targetLocationId, id]
  );

  // Re-fetch updated bin
  const bin = (await fetchBinById(id))!;

  const changes = { location: { old: sourceName, new: targetName } };

  // Log in source location
  logBinActivity(req, { locationId: access.locationId, action: 'move_out', entityId: id, entityName: bin.name, changes });

  // Log in target location
  logBinActivity(req, { locationId: targetLocationId, action: 'move_in', entityId: id, entityName: bin.name, changes });

  res.json(bin);
}));

// POST /api/bins/:id/duplicate — duplicate a bin
router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  // Fetch the source bin
  const src = await fetchBinById(id, { excludeDeleted: true });
  if (!src) {
    throw new NotFoundError('Bin not found');
  }

  const newName = req.body.name ? String(req.body.name).trim() : `Copy of ${src.name}`;
  if (req.body.name) validateBinName(req.body.name);

  // Copy items from source
  const itemsResult = await query<{ name: string; position: number }>(
    'SELECT name, position FROM bin_items WHERE bin_id = $1 ORDER BY position',
    [id]
  );

  const newBin = await insertBinWithItems({
    locationId: src.location_id,
    name: newName,
    areaId: src.area_id || null,
    notes: src.notes || '',
    tags: src.tags || [],
    icon: src.icon || '',
    color: src.color || '',
    cardStyle: src.card_style || '',
    createdBy: req.user!.id,
    visibility: src.visibility || 'location',
    items: itemsResult.rows,
  });

  logBinActivity(req, { locationId: access.locationId, action: 'duplicate', entityId: newBin.id, entityName: newBin.name });

  res.status(201).json(newBin);
}));

// PUT /api/bins/:id/add-tags — add tags to a bin (merge, don't replace)
router.put('/:id/add-tags', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tags } = req.body;

  if (!tags || !Array.isArray(tags)) {
    throw new ValidationError('tags array is required');
  }

  // Validate each tag
  const cleanedTags: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') throw new ValidationError('Each tag must be a string');
    const trimmed = tag.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.length > 100) throw new ValidationError('Tag too long (max 100 characters)');
    cleanedTags.push(trimmed);
  }

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  // Fetch existing tags, merge in JS, then update
  const existing = await query<{ tags: string[] }>(
    'SELECT tags FROM bins WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('Bin not found');
  }

  const currentTags: string[] = existing.rows[0].tags || [];
  const mergedTags = [...new Set([...currentTags, ...cleanedTags])];

  if (mergedTags.length > 50) {
    throw new ValidationError('Too many tags (max 50 total)');
  }

  const result = await query(
    `UPDATE bins SET tags = $1, updated_at = datetime('now')
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, tags`,
    [mergedTags, id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Bin not found');
  }

  res.json(result.rows[0]);
}));

export default router;
