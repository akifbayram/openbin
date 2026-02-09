import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads';

router.use(authenticate);

/** Verify user has access to a photo via photo → bin → home chain */
async function verifyPhotoAccess(photoId: string, userId: string): Promise<{ binId: string; storagePath: string } | null> {
  const result = await query(
    `SELECT p.bin_id, p.storage_path FROM photos p
     JOIN bins b ON b.id = p.bin_id
     JOIN home_members hm ON hm.home_id = b.home_id AND hm.user_id = $2
     WHERE p.id = $1`,
    [photoId, userId]
  );
  if (result.rows.length === 0) return null;
  return { binId: result.rows[0].bin_id, storagePath: result.rows[0].storage_path };
}

// GET /api/photos — list photos for a bin
router.get('/', async (req, res) => {
  try {
    const binId = req.query.bin_id as string | undefined;

    if (!binId) {
      res.status(400).json({ error: 'bin_id query parameter is required' });
      return;
    }

    // Verify user has access to the bin's home
    const accessResult = await query(
      `SELECT b.home_id FROM bins b
       JOIN home_members hm ON hm.home_id = b.home_id AND hm.user_id = $2
       WHERE b.id = $1`,
      [binId, req.user!.id]
    );

    if (accessResult.rows.length === 0) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const result = await query(
      `SELECT id, bin_id, filename, mime_type, size, storage_path, created_by, created_at
       FROM photos WHERE bin_id = $1 ORDER BY created_at ASC`,
      [binId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List photos error:', err);
    res.status(500).json({ error: 'Failed to list photos' });
  }
});

// GET /api/photos/:id/file — serve photo file
router.get('/:id/file', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await verifyPhotoAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const filePath = path.join(PHOTO_STORAGE_PATH, access.storagePath);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Photo file not found on disk' });
      return;
    }

    const photoResult = await query('SELECT mime_type FROM photos WHERE id = $1', [id]);
    const mimeType = photoResult.rows[0]?.mime_type || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Serve photo error:', err);
    res.status(500).json({ error: 'Failed to serve photo' });
  }
});

// DELETE /api/photos/:id — delete photo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await verifyPhotoAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    await query('DELETE FROM photos WHERE id = $1', [id]);

    const filePath = path.join(PHOTO_STORAGE_PATH, access.storagePath);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore file cleanup errors
    }

    await query('UPDATE bins SET updated_at = now() WHERE id = $1', [access.binId]);

    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('Delete photo error:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

export default router;
