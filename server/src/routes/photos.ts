import { Router } from 'express';
import fs from 'fs';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logActivity } from '../lib/activityLog.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../lib/httpErrors.js';
import { safePath } from '../lib/pathSafety.js';
import { PHOTO_STORAGE_PATH } from '../lib/uploadConfig.js';

const router = Router();

router.use(authenticate);

/** Verify user has access to a photo via photo -> bin -> location chain */
async function verifyPhotoAccess(photoId: string, userId: string): Promise<{ binId: string; storagePath: string; locationId: string } | null> {
  const result = await query(
    `SELECT p.bin_id, p.storage_path, b.location_id, b.visibility, b.created_by FROM photos p
     JOIN bins b ON b.id = p.bin_id
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE p.id = $1`,
    [photoId, userId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (row.visibility === 'private' && row.created_by !== userId) return null;
  return { binId: row.bin_id, storagePath: row.storage_path, locationId: row.location_id };
}

// GET /api/photos — list photos for a bin
router.get('/', asyncHandler(async (req, res) => {
  const binId = req.query.bin_id as string | undefined;

  if (!binId) {
    throw new ValidationError('bin_id query parameter is required');
  }

  // Verify user has access to the bin's location (and visibility)
  const accessResult = await query(
    `SELECT b.location_id FROM bins b
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE b.id = $1 AND (b.visibility = 'location' OR b.created_by = $2)`,
    [binId, req.user!.id]
  );

  if (accessResult.rows.length === 0) {
    throw new ForbiddenError('Access denied');
  }

  const result = await query(
    `SELECT id, bin_id, filename, mime_type, size, storage_path, created_by, created_at
     FROM photos WHERE bin_id = $1 ORDER BY created_at ASC`,
    [binId]
  );

  res.json({ results: result.rows, count: result.rows.length });
}));

// GET /api/photos/:id/file — serve photo file
router.get('/:id/file', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const access = await verifyPhotoAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Photo not found');
  }

  const filePath = safePath(PHOTO_STORAGE_PATH, access.storagePath);
  if (!filePath) {
    throw new ValidationError('Invalid file path');
  }

  if (!fs.existsSync(filePath)) {
    throw new NotFoundError('Photo file not found on disk');
  }

  const photoResult = await query('SELECT mime_type FROM photos WHERE id = $1', [id]);
  const mimeType = photoResult.rows[0]?.mime_type || 'application/octet-stream';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  fs.createReadStream(filePath).pipe(res);
}));

// DELETE /api/photos/:id — delete photo
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const access = await verifyPhotoAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Photo not found');
  }

  await query('DELETE FROM photos WHERE id = $1', [id]);

  const filePath = safePath(PHOTO_STORAGE_PATH, access.storagePath);
  if (filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore file cleanup errors
    }
  }

  await query(`UPDATE bins SET updated_at = datetime('now') WHERE id = $1`, [access.binId]);

  // Get bin name for activity log
  const binResult = await query('SELECT name FROM bins WHERE id = $1', [access.binId]);
  logActivity({
    locationId: access.locationId,
    userId: req.user!.id,
    userName: req.user!.username,
    action: 'delete_photo',
    entityType: 'bin',
    entityId: access.binId,
    entityName: binResult.rows[0]?.name,
    authMethod: req.authMethod,
  });

  res.json({ message: 'Photo deleted' });
}));

export default router;
