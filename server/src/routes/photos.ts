import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logActivity } from '../lib/activityLog.js';

const router = Router();
const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads';

function safePath(base: string, relativePath: string): string | null {
  const resolved = path.resolve(base, relativePath);
  if (!resolved.startsWith(path.resolve(base) + path.sep) && resolved !== path.resolve(base)) {
    return null;
  }
  return resolved;
}

router.use(authenticate);

/** Verify user has access to a photo via photo -> bin -> location chain */
async function verifyPhotoAccess(photoId: string, userId: string): Promise<{ binId: string; storagePath: string; locationId: string } | null> {
  const result = await query(
    `SELECT p.bin_id, p.storage_path, b.location_id FROM photos p
     JOIN bins b ON b.id = p.bin_id
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE p.id = $1`,
    [photoId, userId]
  );
  if (result.rows.length === 0) return null;
  return { binId: result.rows[0].bin_id, storagePath: result.rows[0].storage_path, locationId: result.rows[0].location_id };
}

// GET /api/photos — list photos for a bin
router.get('/', async (req, res) => {
  try {
    const binId = req.query.bin_id as string | undefined;

    if (!binId) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'bin_id query parameter is required' });
      return;
    }

    // Verify user has access to the bin's location
    const accessResult = await query(
      `SELECT b.location_id FROM bins b
       JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
       WHERE b.id = $1`,
      [binId, req.user!.id]
    );

    if (accessResult.rows.length === 0) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
      return;
    }

    const result = await query(
      `SELECT id, bin_id, filename, mime_type, size, storage_path, created_by, created_at
       FROM photos WHERE bin_id = $1 ORDER BY created_at ASC`,
      [binId]
    );

    res.json({ results: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('List photos error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list photos' });
  }
});

// GET /api/photos/:id/file — serve photo file
router.get('/:id/file', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await verifyPhotoAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Photo not found' });
      return;
    }

    const filePath = safePath(PHOTO_STORAGE_PATH, access.storagePath);
    if (!filePath) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Invalid file path' });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Photo file not found on disk' });
      return;
    }

    const photoResult = await query('SELECT mime_type FROM photos WHERE id = $1', [id]);
    const mimeType = photoResult.rows[0]?.mime_type || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Serve photo error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to serve photo' });
  }
});

// DELETE /api/photos/:id — delete photo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await verifyPhotoAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Photo not found' });
      return;
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

    await query('UPDATE bins SET updated_at = now() WHERE id = $1', [access.binId]);

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
    });

    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('Delete photo error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete photo' });
  }
});

export default router;
