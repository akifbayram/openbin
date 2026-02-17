import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { query, generateUuid, getDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logActivity, computeChanges } from '../lib/activityLog.js';
import { purgeExpiredTrash } from '../lib/trashPurge.js';
import { generateShortCode } from '../lib/shortCode.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../lib/httpErrors.js';
import { validateBinName } from '../lib/validation.js';
import { binPhotoUpload, PHOTO_STORAGE_PATH } from '../lib/uploadConfig.js';
import { verifyBinAccess, verifyLocationMembership } from '../lib/binAccess.js';
import { BIN_SELECT_COLS } from '../lib/binQueries.js';

const router = Router();

router.use(authenticate);

// POST /api/bins — create bin
router.post('/', asyncHandler(async (req, res) => {
  const { locationId, name, areaId, items, notes, tags, icon, color, id, shortCode } = req.body;

  if (!locationId) {
    throw new ValidationError('locationId is required');
  }

  validateBinName(name);
  if (items && Array.isArray(items) && items.length > 500) {
    throw new ValidationError('Too many items (max 500)');
  }
  if (tags && Array.isArray(tags) && tags.length > 50) {
    throw new ValidationError('Too many tags (max 50)');
  }
  if (notes && typeof notes === 'string' && notes.length > 10000) {
    throw new ValidationError('Notes too long (max 10000 characters)');
  }

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  // Generate short_code with retry on collision
  const sc = shortCode || generateShortCode();
  const maxRetries = 10;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const code = attempt === 0 ? sc : generateShortCode();
    const binId = id || generateUuid();

    try {
      await query(
        `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, created_by, short_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [binId, locationId, name.trim(), areaId || null, notes || '', tags || [], icon || '', color || '', req.user!.id, code]
      );

      // Insert items into bin_items
      const itemsArr: unknown[] = Array.isArray(items) ? items : [];
      for (let i = 0; i < itemsArr.length; i++) {
        const itemName = typeof itemsArr[i] === 'string' ? itemsArr[i] : (itemsArr[i] as { name: string })?.name;
        if (!itemName) continue;
        await query(
          'INSERT INTO bin_items (id, bin_id, name, position) VALUES ($1, $2, $3, $4)',
          [generateUuid(), binId, itemName, i]
        );
      }

      // Re-fetch with BIN_SELECT_COLS
      const result = await query(
        `SELECT ${BIN_SELECT_COLS} FROM bins b LEFT JOIN areas a ON a.id = b.area_id WHERE b.id = $1`,
        [binId]
      );
      const bin = result.rows[0];

      logActivity({
        locationId,
        userId: req.user!.id,
        userName: req.user!.username,
        action: 'create',
        entityType: 'bin',
        entityId: bin.id,
        entityName: bin.name,
      });

      res.status(201).json(bin);
      return;
    } catch (err: unknown) {
      const sqliteErr = err as { code?: string };
      if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE' && attempt < maxRetries) {
        continue; // retry with new code
      }
      throw err;
    }
  }

  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to generate unique short code' });
}));

// GET /api/bins — list all (non-deleted) bins for a location
// Optional query params: q, tag, area_id, sort, sort_dir, needs_organizing
router.get('/', asyncHandler(async (req, res) => {
  const locationId = req.query.location_id as string | undefined;

  if (!locationId) {
    throw new ValidationError('location_id query parameter is required');
  }

  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  const q = req.query.q as string | undefined;
  const tag = req.query.tag as string | undefined;
  const areaId = req.query.area_id as string | undefined;
  const needsOrganizing = req.query.needs_organizing as string | undefined;
  const sort = req.query.sort as string | undefined;
  const sortDir = req.query.sort_dir as string | undefined;

  const whereClauses: string[] = ['b.location_id = $1', 'b.deleted_at IS NULL'];
  const params: unknown[] = [locationId, req.user!.id];
  let paramIdx = 3;

  if (q && q.trim()) {
    const searchTerm = `%${q.trim()}%`;
    whereClauses.push(
      `(b.name LIKE $${paramIdx} OR b.notes LIKE $${paramIdx} OR b.short_code LIKE $${paramIdx} OR COALESCE(a.name, '') LIKE $${paramIdx} OR EXISTS (SELECT 1 FROM bin_items bi WHERE bi.bin_id = b.id AND bi.name LIKE $${paramIdx}) OR EXISTS (SELECT 1 FROM json_each(b.tags) WHERE value LIKE $${paramIdx}))`
    );
    params.push(searchTerm);
    paramIdx++;
  }

  if (tag && tag.trim()) {
    whereClauses.push(`EXISTS (SELECT 1 FROM json_each(b.tags) WHERE value = $${paramIdx})`);
    params.push(tag.trim());
    paramIdx++;
  }

  if (areaId) {
    if (areaId === '__unassigned__') {
      whereClauses.push('b.area_id IS NULL');
    } else {
      whereClauses.push(`b.area_id = $${paramIdx}`);
      params.push(areaId);
      paramIdx++;
    }
  }

  if (needsOrganizing === 'true') {
    whereClauses.push(`(b.tags = '[]' OR b.tags = '') AND b.area_id IS NULL AND NOT EXISTS (SELECT 1 FROM bin_items bi WHERE bi.bin_id = b.id)`);
  }

  const validSorts: Record<string, string> = {
    name: 'b.name',
    created_at: 'b.created_at',
    updated_at: 'b.updated_at',
    area: 'CASE WHEN a.name IS NULL OR a.name = \'\' THEN 1 ELSE 0 END, a.name, b.name',
  };
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
  const orderBy = validSorts[sort || ''] || 'b.updated_at';
  const orderClause = sort === 'area' ? `${orderBy} ${dir}` : `${orderBy} ${dir}`;

  const result = await query(
    `SELECT ${BIN_SELECT_COLS}, CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
     FROM bins b LEFT JOIN areas a ON a.id = b.area_id
     LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2
     WHERE ${whereClauses.join(' AND ')} ORDER BY ${orderClause}`,
    params
  );

  res.json({ results: result.rows, count: result.rows.length });
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
     WHERE b.location_id = $1 AND b.deleted_at IS NOT NULL ORDER BY b.deleted_at DESC`,
    [locationId]
  );

  res.json({ results: result.rows, count: result.rows.length });
}));

// GET /api/bins/lookup/:shortCode — lookup bin by short code
router.get('/lookup/:shortCode', asyncHandler(async (req, res) => {
  const code = req.params.shortCode.toUpperCase();

  const result = await query(
    `SELECT ${BIN_SELECT_COLS}, CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
     FROM bins b
     LEFT JOIN areas a ON a.id = b.area_id
     LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE UPPER(b.short_code) = $1 AND b.deleted_at IS NULL`,
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
     WHERE pb.user_id = $1 AND b.location_id = $2 AND b.deleted_at IS NULL
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

  const result = await query(
    `SELECT ${BIN_SELECT_COLS}, CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
     FROM bins b LEFT JOIN areas a ON a.id = b.area_id
     LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2
     WHERE b.id = $1 AND b.deleted_at IS NULL`,
    [id, req.user!.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Bin not found');
  }

  res.json(result.rows[0]);
}));

// PUT /api/bins/:id — update bin
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  const { name, areaId, items, notes, tags, icon, color } = req.body;

  if (name !== undefined) {
    validateBinName(name);
  }
  if (items !== undefined && Array.isArray(items) && items.length > 500) {
    throw new ValidationError('Too many items (max 500)');
  }
  if (tags !== undefined && Array.isArray(tags) && tags.length > 50) {
    throw new ValidationError('Too many tags (max 50)');
  }
  if (notes !== undefined && typeof notes === 'string' && notes.length > 10000) {
    throw new ValidationError('Notes too long (max 10000 characters)');
  }

  // Fetch old state for activity log diff
  const oldResult = await query(
    'SELECT name, area_id, notes, tags, icon, color FROM bins WHERE id = $1',
    [id]
  );
  const oldBin = oldResult.rows[0];

  const setClauses: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (name !== undefined) {
    setClauses.push(`name = $${paramIdx++}`);
    params.push(name);
  }
  if (areaId !== undefined) {
    setClauses.push(`area_id = $${paramIdx++}`);
    params.push(areaId || null);
  }
  if (notes !== undefined) {
    setClauses.push(`notes = $${paramIdx++}`);
    params.push(notes);
  }
  if (tags !== undefined) {
    setClauses.push(`tags = $${paramIdx++}`);
    params.push(tags);
  }
  if (icon !== undefined) {
    setClauses.push(`icon = $${paramIdx++}`);
    params.push(icon);
  }
  if (color !== undefined) {
    setClauses.push(`color = $${paramIdx++}`);
    params.push(color);
  }

  params.push(id);

  await query(
    `UPDATE bins SET ${setClauses.join(', ')} WHERE id = $${paramIdx} AND deleted_at IS NULL`,
    params
  );

  // Handle items separately — full replacement
  let itemChanges: Record<string, { old: unknown; new: unknown }> | undefined;
  if (items !== undefined && Array.isArray(items)) {
    const oldItemsResult = await query<{ name: string }>(
      'SELECT name FROM bin_items WHERE bin_id = $1 ORDER BY position',
      [id]
    );
    const oldItemNames = oldItemsResult.rows.map((r) => r.name);

    // Delete all existing items and re-insert
    await query('DELETE FROM bin_items WHERE bin_id = $1', [id]);
    for (let i = 0; i < items.length; i++) {
      const itemName = typeof items[i] === 'string' ? items[i] : (items[i] as { name: string }).name;
      if (!itemName) continue;
      await query(
        'INSERT INTO bin_items (id, bin_id, name, position) VALUES ($1, $2, $3, $4)',
        [generateUuid(), id, itemName, i]
      );
    }

    const newItemNames = items.map((item: string | { name: string }) =>
      typeof item === 'string' ? item : item.name
    );
    const added = newItemNames.filter((n: string) => !oldItemNames.includes(n));
    const removed = oldItemNames.filter((n) => !newItemNames.includes(n));
    if (added.length > 0 || removed.length > 0) {
      itemChanges = {};
      if (added.length > 0) itemChanges.items_added = { old: null, new: added };
      if (removed.length > 0) itemChanges.items_removed = { old: removed, new: null };
    }
  }

  // Re-fetch with BIN_SELECT_COLS
  const result = await query(
    `SELECT ${BIN_SELECT_COLS}, CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
     FROM bins b LEFT JOIN areas a ON a.id = b.area_id
     LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2
     WHERE b.id = $1 AND b.deleted_at IS NULL`,
    [id, req.user!.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Bin not found');
  }

  const bin = result.rows[0];

  if (oldBin) {
    const newObj: Record<string, unknown> = {};
    if (name !== undefined) newObj.name = name;
    if (areaId !== undefined) newObj.area_id = areaId || null;
    if (notes !== undefined) newObj.notes = notes;
    if (tags !== undefined) newObj.tags = tags;
    if (icon !== undefined) newObj.icon = icon;
    if (color !== undefined) newObj.color = color;

    const binFieldChanges = computeChanges(oldBin, newObj, Object.keys(newObj));

    // Replace area_id UUIDs with readable area names
    if (binFieldChanges?.area_id) {
      const oldAreaName = oldBin.area_id
        ? ((await query<{ name: string }>('SELECT name FROM areas WHERE id = $1', [oldBin.area_id])).rows[0]?.name ?? '')
        : '';
      const newAreaId = newObj.area_id as string | null;
      const newAreaName = newAreaId
        ? ((await query<{ name: string }>('SELECT name FROM areas WHERE id = $1', [newAreaId])).rows[0]?.name ?? '')
        : '';
      delete binFieldChanges.area_id;
      binFieldChanges.area = { old: oldAreaName || null, new: newAreaName || null };
    }

    const allChanges = { ...binFieldChanges, ...itemChanges };
    if (Object.keys(allChanges).length > 0) {
      logActivity({
        locationId: access.locationId,
        userId: req.user!.id,
        userName: req.user!.username,
        action: 'update',
        entityType: 'bin',
        entityId: id,
        entityName: bin.name,
        changes: allChanges,
      });
    }
  }

  res.json(bin);
}));

// DELETE /api/bins/:id — soft-delete bin
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  // Fetch bin before soft-deleting for response
  const binResult = await query(
    `SELECT ${BIN_SELECT_COLS}
     FROM bins b LEFT JOIN areas a ON a.id = b.area_id
     WHERE b.id = $1 AND b.deleted_at IS NULL`,
    [id]
  );

  if (binResult.rows.length === 0) {
    throw new NotFoundError('Bin not found');
  }

  const bin = binResult.rows[0];

  // Soft delete
  await query("UPDATE bins SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = $1", [id]);

  logActivity({
    locationId: access.locationId,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'delete',
    entityType: 'bin',
    entityId: id,
    entityName: bin.name,
  });

  res.json(bin);
}));

// POST /api/bins/:id/restore — restore a soft-deleted bin
router.post('/:id/restore', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check access but for deleted bins
  const accessResult = await query(
    `SELECT b.location_id FROM bins b
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE b.id = $1 AND b.deleted_at IS NOT NULL`,
    [id, req.user!.id]
  );

  if (accessResult.rows.length === 0) {
    throw new NotFoundError('Deleted bin not found');
  }

  const locationId = accessResult.rows[0].location_id;

  await query(
    `UPDATE bins SET deleted_at = NULL, updated_at = datetime('now') WHERE id = $1`,
    [id]
  );

  const result = await query(
    `SELECT ${BIN_SELECT_COLS} FROM bins b LEFT JOIN areas a ON a.id = b.area_id WHERE b.id = $1`,
    [id]
  );
  const bin = result.rows[0];

  logActivity({
    locationId,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'restore',
    entityType: 'bin',
    entityId: id,
    entityName: bin.name,
  });

  res.json(bin);
}));

// DELETE /api/bins/:id/permanent — permanently delete a soft-deleted bin
router.delete('/:id/permanent', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Only allow permanent delete of already soft-deleted bins
  const accessResult = await query(
    `SELECT b.location_id, b.name FROM bins b
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE b.id = $1 AND b.deleted_at IS NOT NULL`,
    [id, req.user!.id]
  );

  if (accessResult.rows.length === 0) {
    throw new NotFoundError('Deleted bin not found');
  }

  const { location_id: locationId, name: binName } = accessResult.rows[0];

  // Get photos to delete from disk
  const photosResult = await query(
    'SELECT storage_path FROM photos WHERE bin_id = $1',
    [id]
  );

  // Hard delete (cascades to photos in DB)
  await query('DELETE FROM bins WHERE id = $1', [id]);

  // Clean up photo files from disk
  for (const photo of photosResult.rows) {
    try {
      const filePath = path.join(PHOTO_STORAGE_PATH, photo.storage_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore file cleanup errors
    }
  }

  // Clean up empty bin directory
  try {
    const binDir = path.join(PHOTO_STORAGE_PATH, id);
    if (fs.existsSync(binDir)) {
      fs.rmdirSync(binDir);
    }
  } catch {
    // Ignore directory cleanup errors
  }

  logActivity({
    locationId,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'permanent_delete',
    entityType: 'bin',
    entityId: id,
    entityName: binName,
  });

  res.json({ message: 'Bin permanently deleted' });
}));

// POST /api/bins/:id/photos — upload photo for a bin
router.post('/:id/photos', binPhotoUpload.single('photo'), asyncHandler(async (req, res) => {
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
  const photoId = generateUuid();

  const result = await query(
    `INSERT INTO photos (id, bin_id, filename, mime_type, size, storage_path, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, bin_id, filename, mime_type, size, storage_path, created_by, created_at`,
    [photoId, binId, file.originalname, file.mimetype, file.size, storagePath, req.user!.id]
  );

  await query("UPDATE bins SET updated_at = datetime('now') WHERE id = $1", [binId]);

  const photo = result.rows[0];

  // Get bin name for activity log
  const binResult = await query('SELECT name FROM bins WHERE id = $1', [binId]);
  logActivity({
    locationId: access.locationId,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'add_photo',
    entityType: 'bin',
    entityId: binId,
    entityName: binResult.rows[0]?.name,
  });

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

// POST /api/bins/:id/move — move bin to a different location
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
  const result = await query(
    `SELECT ${BIN_SELECT_COLS} FROM bins b LEFT JOIN areas a ON a.id = b.area_id WHERE b.id = $1`,
    [id]
  );
  const bin = result.rows[0];

  const changes = { location: { old: sourceName, new: targetName } };

  // Log in source location
  logActivity({
    locationId: access.locationId,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'move_out',
    entityType: 'bin',
    entityId: id,
    entityName: bin.name,
    changes,
  });

  // Log in target location
  logActivity({
    locationId: targetLocationId,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'move_in',
    entityType: 'bin',
    entityId: id,
    entityName: bin.name,
    changes,
  });

  res.json(bin);
}));

// PUT /api/bins/:id/add-tags — add tags to a bin (merge, don't replace)
router.put('/:id/add-tags', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tags } = req.body;

  if (!tags || !Array.isArray(tags)) {
    throw new ValidationError('tags array is required');
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
  const mergedTags = [...new Set([...currentTags, ...tags])];

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
