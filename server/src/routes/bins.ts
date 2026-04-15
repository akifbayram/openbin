import crypto from 'node:crypto';
import path from 'node:path';
import { Router } from 'express';
import { d, query, withTransaction } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { cleanupBinAttachments } from '../lib/attachmentsCleanup.js';
import { getMemberRole, requireAdmin, requireMemberOrAbove, verifyAreaInLocation, verifyBinAccess, verifyDeletedBinAccess, verifyLocationMembership } from '../lib/binAccess.js';
import { BIN_SELECT_COLS, buildBinListQuery, fetchBinById } from '../lib/binQueries.js';
import { buildBinSetClauses, buildBinUpdateDiff, insertBinWithItems, replaceBinItems } from '../lib/binUpdateHelpers.js';
import { validateBinFields, validateCodeFormat } from '../lib/binValidation.js';
import { config } from '../lib/config.js';
import { remapCustomFieldsForMove, replaceCustomFieldValues } from '../lib/customFieldHelpers.js';
import { ForbiddenError, NotFoundError, OverLimitError, QuotaExceededError, ValidationError } from '../lib/httpErrors.js';
import { cleanupBinPhotos } from '../lib/photoCleanup.js';
import { generateThumbnail } from '../lib/photoHelpers.js';
import { assertLocationWritable, generateUpgradeUrl, getUserFeatures, getUserPlanInfo, invalidateOverLimitCache } from '../lib/planGate.js';
import { sensitiveAuthLimiter } from '../lib/rateLimiters.js';
import { getUserUsageTrackingPrefs, recordBinUsage } from '../lib/recordBinUsage.js';
import { logRouteActivity } from '../lib/routeHelpers.js';
import { storage } from '../lib/storage.js';
import { generateThumbnailBuffer } from '../lib/thumbnailPool.js';
import { purgeExpiredTrash } from '../lib/trashPurge.js';
import { binPhotoUpload, MIME_TO_EXT, validateFileBuffer, validateFileType } from '../lib/uploadConfig.js';
import { validateBinName } from '../lib/validation.js';
import { authenticate } from '../middleware/auth.js';
import { requireCleanFile } from '../middleware/malwareScan.js';

const router = Router();

router.use(authenticate);

// POST /api/bins — create bin
router.post('/', asyncHandler(async (req, res) => {
  const { locationId, name, areaId, items, notes, tags, icon, color, visibility, cardStyle, customFields } = req.body;

  if (!locationId) {
    throw new ValidationError('locationId is required');
  }

  validateBinName(name);
  validateBinFields({ items, tags, notes, icon, color, cardStyle, visibility, customFields });

  await requireMemberOrAbove(locationId, req.user!.id, 'create bins');

  await assertLocationWritable(locationId);

  if (areaId) await verifyAreaInLocation(areaId, locationId);

  // assertBinCreationAllowed check is performed inside the transaction (via assertLimitUserId)
  // to prevent concurrent requests from bypassing the plan limit.
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
    customFields: customFields || undefined,
  }, req.user!.id);

  logRouteActivity(req, { entityType: 'bin', locationId, action: 'create', entityId: bin.id, entityName: bin.name });

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

  // Pagination — cap explicit limit to 200, default 200 when omitted
  const limitRaw = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
  const limit = limitRaw !== undefined && !Number.isNaN(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 200;
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const { ctePrefix, whereSQL, orderClause, params } = buildBinListQuery({
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
    unusedSince: req.query.unused_since as string | undefined,  // NEW
    sort: req.query.sort as string | undefined,
    sortDir: req.query.sort_dir as string | undefined,
  });

  const countResult = await query(
    `${ctePrefix}SELECT COUNT(*) AS total FROM bins b LEFT JOIN areas a ON a.id = b.area_id WHERE ${whereSQL}`,
    params
  );
  const total = (countResult.rows[0] as { total: number }).total;

  const paginatedParams = [...params, limit, offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const result = await query(
    `${ctePrefix}SELECT ${BIN_SELECT_COLS()}, CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
     FROM bins b LEFT JOIN areas a ON a.id = b.area_id
     LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2
     WHERE ${whereSQL} ORDER BY ${orderClause} LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    paginatedParams
  );

  res.json({ results: result.rows, count: total });
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
    `SELECT ${BIN_SELECT_COLS()}, b.deleted_at
     FROM bins b LEFT JOIN areas a ON a.id = b.area_id
     WHERE b.location_id = $1 AND b.deleted_at IS NOT NULL AND (b.visibility = 'location' OR b.created_by = $2) ORDER BY b.deleted_at DESC LIMIT 500`,
    [locationId, req.user!.id]
  );

  res.json({ results: result.rows, count: result.rows.length });
}));

// GET /api/bins/lookup/:shortCode — lookup bin by short code
router.get('/lookup/:shortCode', asyncHandler(async (req, res) => {
  const code = req.params.shortCode.toUpperCase();

  const result = await query(
    `SELECT ${BIN_SELECT_COLS()}, CASE WHEN pb.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned
     FROM bins b
     LEFT JOIN areas a ON a.id = b.area_id
     LEFT JOIN pinned_bins pb ON pb.bin_id = b.id AND pb.user_id = $2
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE UPPER(b.short_code) = $1 AND b.deleted_at IS NULL AND (b.visibility = 'location' OR b.created_by = $2)`,
    [code, req.user!.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Bin not found');
  }

  res.json(result.rows[0]);
}));

// POST /api/bins/:id/change-code — change a bin's short code (admin only)
router.post('/:id/change-code', sensitiveAuthLimiter, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    throw new ValidationError('Code is required');
  }

  const newCode = code.toUpperCase();
  validateCodeFormat(newCode);

  // Verify access to target bin
  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  const currentResult = await query<{ short_code: string }>('SELECT short_code FROM bins WHERE id = $1', [id]);
  if (currentResult.rows.length === 0) throw new NotFoundError('Bin not found');
  const oldCode = currentResult.rows[0].short_code;

  if (newCode === oldCode.toUpperCase()) {
    throw new ValidationError('New code is the same as current code');
  }

  await requireAdmin(access.locationId, req.user!.id, 'change bin code');

  // Check uniqueness within location
  const conflict = await query<{ id: string }>(
    'SELECT id FROM bins WHERE location_id = $1 AND UPPER(short_code) = $2 AND id != $3',
    [access.locationId, newCode, id]
  );
  if (conflict.rows.length > 0) {
    throw new ValidationError('This code is already in use in this location');
  }

  await query(`UPDATE bins SET short_code = $1, updated_at = ${d.now()} WHERE id = $2`, [newCode, id]);

  const updatedBin = await fetchBinById(id, { userId: req.user!.id });
  if (!updatedBin) {
    throw new NotFoundError('Bin not found after code change');
  }

  logRouteActivity(req, {
    entityType: 'bin',
    locationId: access.locationId,
    action: 'code_changed',
    entityId: id,
    entityName: updatedBin.name,
    changes: { code: { old: oldCode, new: newCode } },
  });

  res.json(updatedBin);
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

  // Fire-and-forget: record a usage dot if the user has view tracking enabled.
  // Note: when both scan and view prefs are enabled, a single QR scan can
  // increment `count` multiple times (ScanDialog's validate fetch, the scan
  // POST, and the detail page's mount fetch each trigger a write). This
  // does not affect the dot's existence (one dot per UTC day) but does inflate
  // the per-day `count` field. The default config (view=false) avoids this.
  getUserUsageTrackingPrefs(req.user!.id)
    .then((prefs) => {
      if (prefs.view) recordBinUsage(id, req.user!.id);
    })
    .catch(() => {});

  res.json(bin);
}));

// PUT /api/bins/:id — update bin
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  await assertLocationWritable(access.locationId);

  // Viewers cannot edit at all
  const role = await getMemberRole(access.locationId, req.user!.id);
  if (role === 'viewer') {
    throw new ForbiddenError('Viewers cannot edit bins');
  }

  const { name, areaId, items, notes, tags, icon, color, cardStyle, visibility, customFields } = req.body;

  // Determine if this update contains metadata changes (anything besides items)
  const hasMetadataChanges = name !== undefined || areaId !== undefined || notes !== undefined
    || tags !== undefined || icon !== undefined || color !== undefined
    || cardStyle !== undefined || visibility !== undefined || customFields !== undefined;

  // Members can edit items on any bin, but metadata only on bins they created
  if (role === 'member' && hasMetadataChanges && access.createdBy !== req.user!.id) {
    throw new ForbiddenError('Only admins or the bin creator can edit bin metadata');
  }

  if (name !== undefined) {
    validateBinName(name);
  }
  validateBinFields({ items, tags, notes, icon, color, cardStyle, visibility, customFields });
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

  // Handle custom fields separately — full replacement
  if (customFields !== undefined && typeof customFields === 'object' && customFields !== null) {
    await replaceCustomFieldValues(id, customFields, access.locationId);
  }

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
      logRouteActivity(req, { entityType: 'bin', locationId: access.locationId, action: 'update', entityId: id, entityName: bin.name, changes });
    }
  }

  res.json(bin);

  // Fire-and-forget: record a usage dot if the user has modify tracking enabled
  getUserUsageTrackingPrefs(req.user!.id)
    .then((prefs) => {
      if (prefs.modify) recordBinUsage(id, req.user!.id);
    })
    .catch(() => {});
}));

// DELETE /api/bins/:id — soft-delete bin (admin only)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  await assertLocationWritable(access.locationId);

  await requireAdmin(access.locationId, req.user!.id, 'delete bins');

  // Fetch bin before soft-deleting for response
  const bin = await fetchBinById(id, { excludeDeleted: true });
  if (!bin) {
    throw new NotFoundError('Bin not found');
  }

  // Soft delete
  await query(`UPDATE bins SET deleted_at = ${d.now()}, updated_at = ${d.now()} WHERE id = $1`, [id]);

  logRouteActivity(req, { entityType: 'bin', locationId: access.locationId, action: 'delete', entityId: id, entityName: bin.name });

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

  // Enforce bin limit inside a transaction with row lock to prevent concurrent bypass
  await withTransaction(async (tx) => {
    const { assertBinCreationAllowedTx: assertLimitTx } = await import('../lib/planGate.js');
    await assertLimitTx(req.user!.id, tx);
    await tx(
      `UPDATE bins SET deleted_at = NULL, updated_at = ${d.now()} WHERE id = $1`,
      [id],
    );
  });

  const bin = (await fetchBinById(id))!;

  logRouteActivity(req, { entityType: 'bin', locationId, action: 'restore', entityId: id, entityName: bin.name });

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

  // Snapshot disk paths before the DB delete cascades the rows away.
  const [photosResult, attachmentsResult] = await Promise.all([
    query<{ storage_path: string; thumb_path: string | null }>(
      'SELECT storage_path, thumb_path FROM photos WHERE bin_id = $1',
      [id],
    ),
    query<{ storage_path: string }>(
      'SELECT storage_path FROM attachments WHERE bin_id = $1',
      [id],
    ),
  ]);

  await query('DELETE FROM bins WHERE id = $1', [id]);

  await Promise.all([
    cleanupBinPhotos(id, photosResult.rows),
    cleanupBinAttachments(id, attachmentsResult.rows),
  ]);

  logRouteActivity(req, { entityType: 'bin', locationId, action: 'permanent_delete', entityId: id, entityName: binName });

  res.json({ message: 'Bin permanently deleted' });
}));

// POST /api/bins/:id/photos — upload photo for a bin
router.post('/:id/photos', asyncHandler(async (req, res, next) => {
  // Best-effort: reject before multer buffers. +1 KB for multipart overhead.
  const cl = req.headers['content-length'];
  if (cl) {
    const maxBytes = config.maxPhotoSizeMb * 1024 * 1024 + 1024;
    if (Number(cl) > maxBytes) {
      throw new QuotaExceededError('PAYLOAD_TOO_LARGE', `Upload exceeds ${config.maxPhotoSizeMb} MB limit`);
    }
  }

  // Validate bin access before multer writes file to disk
  const binId = req.params.id;
  const access = await verifyBinAccess(binId, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }
  await requireMemberOrAbove(access.locationId, req.user!.id, 'upload photos');

  await assertLocationWritable(access.locationId);

  res.locals.binAccess = access;

  // Per-bin photo count limit (always enforced)
  const countResult = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM photos WHERE bin_id = $1', [binId]);
  if (countResult.rows[0].cnt >= config.maxPhotosPerBin) {
    throw new QuotaExceededError('BIN_PHOTO_LIMIT', `Maximum ${config.maxPhotosPerBin} photos per bin`);
  }

  // Per-user storage quotas (plan limit + demo limit share one query)
  const photoFeatures = await getUserFeatures(req.user!.id);

  // Block uploads entirely for zero-storage plans (e.g. Free tier)
  if (photoFeatures.maxPhotoStorageMb !== null && photoFeatures.maxPhotoStorageMb === 0) {
    const planInfo = await getUserPlanInfo(req.user!.id);
    const upgradeUrl = planInfo ? await generateUpgradeUrl(req.user!.id, planInfo.email) : null;
    throw new OverLimitError('Photo uploads are available on Plus and Pro plans', upgradeUrl);
  }

  const needsUserUsage = photoFeatures.maxPhotoStorageMb !== null || config.demoMode;
  if (needsUserUsage) {
    const usageResult = await query<{ total: number }>('SELECT COALESCE(SUM(size), 0) as total FROM photos WHERE created_by = $1', [req.user!.id]);
    const usedBytes = usageResult.rows[0].total;

    if (photoFeatures.maxPhotoStorageMb !== null && usedBytes >= photoFeatures.maxPhotoStorageMb * 1024 * 1024) {
      const planInfo = await getUserPlanInfo(req.user!.id);
      const upgradeUrl = planInfo ? await generateUpgradeUrl(req.user!.id, planInfo.email) : null;
      throw new OverLimitError(`Photo storage limit reached (${photoFeatures.maxPhotoStorageMb} MB)`, upgradeUrl);
    }

    if (config.demoMode) {
      if (usedBytes >= config.uploadQuotaDemoMb * 1024 * 1024) {
        const usedMb = (usedBytes / (1024 * 1024)).toFixed(1);
        throw new QuotaExceededError('USER_QUOTA_EXCEEDED', `Upload quota exceeded: ${usedMb} MB used of ${config.uploadQuotaDemoMb} MB allowed`);
      }

      const globalResult = await query<{ total: number }>('SELECT COALESCE(SUM(size), 0) as total FROM photos');
      const globalBytes = globalResult.rows[0].total;
      if (globalBytes >= config.uploadQuotaGlobalDemoMb * 1024 * 1024) {
        throw new QuotaExceededError('GLOBAL_QUOTA_EXCEEDED', `Demo storage limit reached (${config.uploadQuotaGlobalDemoMb} MB). Please contact the administrator.`);
      }
    }
  }

  next();
}), binPhotoUpload.single('photo'), requireCleanFile, asyncHandler(async (req, res) => {
  const binId = req.params.id;
  const file = req.file;

  if (!file) {
    throw new ValidationError('No photo uploaded');
  }

  const isS3 = config.storageBackend === 's3';
  const access = res.locals.binAccess as import('../lib/binAccess.js').BinAccessResult;

  if (isS3) {
    await validateFileBuffer(file.buffer);
  } else {
    await validateFileType(file.path);
  }

  // For S3 (memoryStorage), multer doesn't generate a filename
  const photoFilename = isS3
    ? `${crypto.randomUUID()}${MIME_TO_EXT[file.mimetype] || '.jpg'}`
    : file.filename;
  const storagePath = path.join(binId, photoFilename);
  const photoId = crypto.randomUUID();

  // Generate thumbnail + upload original in parallel
  const thumbFilename = `${path.basename(photoFilename, path.extname(photoFilename))}_thumb.webp`;
  let thumbPath: string | null = null;

  if (isS3) {
    // S3: upload original and generate thumbnail concurrently
    const thumbPromise = generateThumbnailBuffer(file.buffer)
      .then(async (thumbBuffer) => {
        const thumbStoragePath = path.join(binId, thumbFilename);
        await storage.upload(thumbStoragePath, thumbBuffer, 'image/webp');
        return thumbStoragePath;
      })
      .catch(() => null);

    const [, resolvedThumbPath] = await Promise.all([
      storage.upload(storagePath, file.buffer, file.mimetype),
      thumbPromise,
    ]);
    thumbPath = resolvedThumbPath;
    (file as any).buffer = undefined; // release for GC
  } else {
    // Local: file already on disk from multer, just generate thumbnail
    try {
      const thumbFullPath = path.join(path.dirname(file.path), thumbFilename);
      await generateThumbnail(file.path, thumbFullPath);
      thumbPath = path.join(binId, thumbFilename);
    } catch {
      // Thumbnail generation is non-critical
    }
  }

  // Insert photo record + update bin timestamp inside a transaction with a
  // serialized storage quota re-check to prevent concurrent uploads from
  // bypassing the plan limit (the pre-multer check is best-effort only).
  const result = await withTransaction(async (tx) => {
    const { assertPhotoStorageAllowedTx } = await import('../lib/planGate.js');
    await assertPhotoStorageAllowedTx(req.user!.id, tx);

    const [insertResult] = await Promise.all([
      tx(
        `INSERT INTO photos (id, bin_id, filename, mime_type, size, storage_path, thumb_path, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, bin_id, filename, mime_type, size, storage_path, thumb_path, created_by, created_at`,
        [photoId, binId, path.basename(file.originalname).slice(0, 255), file.mimetype, file.size, storagePath, thumbPath, req.user!.id]
      ),
      tx(`UPDATE bins SET updated_at = ${d.now()} WHERE id = $1`, [binId]),
    ]);
    return insertResult;
  });

  invalidateOverLimitCache(req.user!.id);

  const photo = result.rows[0];

  logRouteActivity(req, { entityType: 'bin', locationId: access.locationId, action: 'add_photo', entityId: binId, entityName: access.name });

  res.status(201).json({ id: photo.id });
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

  // Check if user is admin on target — non-admins must not auto-create custom field definitions
  const targetRole = await getMemberRole(targetLocationId, req.user!.id);
  const skipFieldCreation = targetRole !== 'admin';

  // Move bin: update location, clear area, remap custom fields (all in one transaction)
  await withTransaction(async (tx) => {
    await tx(
      `UPDATE bins SET location_id = $1, area_id = NULL, updated_at = ${d.now()} WHERE id = $2`,
      [targetLocationId, id],
    );
    await remapCustomFieldsForMove(id, access.locationId, targetLocationId, skipFieldCreation, tx);
  });

  // Re-fetch updated bin
  const bin = (await fetchBinById(id))!;

  const changes = { location: { old: sourceName, new: targetName } };

  // Log in source location
  logRouteActivity(req, { entityType: 'bin', locationId: access.locationId, action: 'move_out', entityId: id, entityName: bin.name, changes });

  // Log in target location
  logRouteActivity(req, { entityType: 'bin', locationId: targetLocationId, action: 'move_in', entityId: id, entityName: bin.name, changes });

  res.json(bin);
}));

// POST /api/bins/:id/duplicate — duplicate a bin
router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const access = await verifyBinAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  await requireMemberOrAbove(access.locationId, req.user!.id, 'duplicate bins');

  // assertBinCreationAllowed check is performed inside the transaction (via assertLimitUserId)

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

  // custom_fields is already deserialized by db.ts JSON_COLUMNS
  const srcCustomFields =
    src.custom_fields && typeof src.custom_fields === 'object' && Object.keys(src.custom_fields).length > 0
      ? (src.custom_fields as Record<string, string>)
      : undefined;

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
    customFields: srcCustomFields,
  }, req.user!.id);

  logRouteActivity(req, { entityType: 'bin', locationId: access.locationId, action: 'duplicate', entityId: newBin.id, entityName: newBin.name });

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

  await requireMemberOrAbove(access.locationId, req.user!.id, 'add tags to bins');

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
    `UPDATE bins SET tags = $1, updated_at = ${d.now()}
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
