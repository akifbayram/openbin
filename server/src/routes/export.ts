import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query, pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireHomeMember } from '../middleware/homeAccess.js';

const router = Router();
const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads';

router.use(authenticate);

interface ExportBin {
  id: string;
  name: string;
  location: string;
  items: string[];
  notes: string;
  tags: string[];
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  photos: ExportPhoto[];
}

interface ExportPhoto {
  id: string;
  filename: string;
  mimeType: string;
  data: string; // base64
}

interface ExportData {
  version: 2;
  exportedAt: string;
  homeName: string;
  bins: ExportBin[];
}

// Legacy V1 format types
interface LegacyBinV1 {
  id?: string | number;
  name: string;
  contents?: string;
  items?: string[];
  notes?: string;
  tags?: string[];
  location?: string;
  icon?: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
  photos?: LegacyPhotoV1[];
}

interface LegacyPhotoV1 {
  id?: string | number;
  data: string;
  type?: string;
  mimeType?: string;
  filename?: string;
}

// GET /api/homes/:id/export — export all bins + photos for a home
router.get('/homes/:id/export', requireHomeMember(), async (req, res) => {
  try {
    const homeId = req.params.id;

    // Get home name
    const homeResult = await query('SELECT name FROM homes WHERE id = $1', [homeId]);
    if (homeResult.rows.length === 0) {
      res.status(404).json({ error: 'Home not found' });
      return;
    }

    const homeName = homeResult.rows[0].name;

    // Get all bins for this home
    const binsResult = await query(
      'SELECT id, name, location, items, notes, tags, icon, color, created_at, updated_at FROM bins WHERE home_id = $1 ORDER BY updated_at DESC',
      [homeId]
    );

    const exportBins: ExportBin[] = [];

    for (const bin of binsResult.rows) {
      // Get photos for this bin
      const photosResult = await query(
        'SELECT id, filename, mime_type, storage_path FROM photos WHERE bin_id = $1',
        [bin.id]
      );

      const exportPhotos: ExportPhoto[] = [];
      for (const photo of photosResult.rows) {
        const filePath = path.join(PHOTO_STORAGE_PATH, photo.storage_path);
        try {
          if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath);
            exportPhotos.push({
              id: photo.id,
              filename: photo.filename,
              mimeType: photo.mime_type,
              data: data.toString('base64'),
            });
          }
        } catch {
          // Skip photos that can't be read
        }
      }

      exportBins.push({
        id: bin.id,
        name: bin.name,
        location: bin.location,
        items: bin.items,
        notes: bin.notes,
        tags: bin.tags,
        icon: bin.icon,
        color: bin.color,
        createdAt: bin.created_at.toISOString(),
        updatedAt: bin.updated_at.toISOString(),
        photos: exportPhotos,
      });
    }

    const exportData: ExportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      homeName,
      bins: exportBins,
    };

    res.setHeader('Content-Disposition', `attachment; filename="qrbin-export-${homeId}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// POST /api/homes/:id/import — import bins + photos
router.post('/homes/:id/import', requireHomeMember(), async (req, res) => {
  try {
    const homeId = req.params.id;
    const { bins, mode } = req.body as { bins: ExportBin[]; mode: 'merge' | 'replace' };

    if (!bins || !Array.isArray(bins)) {
      res.status(400).json({ error: 'bins array is required' });
      return;
    }

    const importMode = mode || 'merge';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (importMode === 'replace') {
        // Get existing photos to clean up files
        const existingPhotos = await client.query(
          'SELECT storage_path FROM photos WHERE bin_id IN (SELECT id FROM bins WHERE home_id = $1)',
          [homeId]
        );
        // Delete existing bins (cascade deletes photos in DB)
        await client.query('DELETE FROM bins WHERE home_id = $1', [homeId]);
        // Clean up photo files
        for (const photo of existingPhotos.rows) {
          try {
            const filePath = path.join(PHOTO_STORAGE_PATH, photo.storage_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch { /* ignore */ }
        }
      }

      let binsImported = 0;
      let binsSkipped = 0;
      let photosImported = 0;

      for (const bin of bins) {
        if (importMode === 'merge') {
          // Check if bin already exists
          const existing = await client.query('SELECT id FROM bins WHERE id = $1', [bin.id]);
          if (existing.rows.length > 0) {
            binsSkipped++;
            continue;
          }
        }

        const binId = bin.id || uuidv4();

        await client.query(
          `INSERT INTO bins (id, home_id, name, location, items, notes, tags, icon, color, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            binId,
            homeId,
            bin.name,
            bin.location || '',
            bin.items || [],
            bin.notes || '',
            bin.tags || [],
            bin.icon || '',
            bin.color || '',
            req.user!.id,
            bin.createdAt ? new Date(bin.createdAt) : new Date(),
            bin.updatedAt ? new Date(bin.updatedAt) : new Date(),
          ]
        );

        // Import photos
        if (bin.photos && Array.isArray(bin.photos)) {
          for (const photo of bin.photos) {
            const photoId = photo.id || uuidv4();
            const ext = path.extname(photo.filename) || '.jpg';
            const filename = `${photoId}${ext}`;
            const storagePath = path.join(binId, filename);
            const dir = path.join(PHOTO_STORAGE_PATH, binId);

            fs.mkdirSync(dir, { recursive: true });
            const buffer = Buffer.from(photo.data, 'base64');
            fs.writeFileSync(path.join(PHOTO_STORAGE_PATH, storagePath), buffer);

            await client.query(
              `INSERT INTO photos (id, bin_id, filename, mime_type, size, storage_path, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [photoId, binId, photo.filename, photo.mimeType, buffer.length, storagePath, req.user!.id]
            );
            photosImported++;
          }
        }

        binsImported++;
      }

      await client.query('COMMIT');

      res.json({
        binsImported,
        binsSkipped,
        photosImported,
        photosSkipped: 0,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

// POST /api/import/legacy — import legacy V1/V2 format
router.post('/import/legacy', async (req, res) => {
  try {
    const { homeId, data } = req.body;

    if (!homeId) {
      res.status(400).json({ error: 'homeId is required' });
      return;
    }

    if (!data) {
      res.status(400).json({ error: 'data is required' });
      return;
    }

    // Verify membership
    const memberResult = await query(
      'SELECT id FROM home_members WHERE home_id = $1 AND user_id = $2',
      [homeId, req.user!.id]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ error: 'Not a member of this home' });
      return;
    }

    // Normalize legacy data to V2 format
    const legacyBins: LegacyBinV1[] = data.bins || [];

    const normalizedBins: ExportBin[] = legacyBins.map(bin => {
      // Convert V1 contents string to items array if needed
      let items: string[] = bin.items || [];
      if (items.length === 0 && bin.contents) {
        items = bin.contents.split('\n').filter(s => s.trim().length > 0);
      }

      const photos: ExportPhoto[] = (bin.photos || []).map(p => ({
        id: String(p.id || uuidv4()),
        filename: p.filename || 'photo.jpg',
        mimeType: p.mimeType || p.type || 'image/jpeg',
        data: p.data,
      }));

      return {
        id: String(bin.id || uuidv4()),
        name: bin.name,
        location: bin.location || '',
        items,
        notes: bin.notes || '',
        tags: bin.tags || [],
        icon: bin.icon || '',
        color: bin.color || '',
        createdAt: bin.createdAt || new Date().toISOString(),
        updatedAt: bin.updatedAt || new Date().toISOString(),
        photos,
      };
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let imported = 0;

      for (const bin of normalizedBins) {
        const binId = bin.id;

        // Skip if already exists
        const existing = await client.query('SELECT id FROM bins WHERE id = $1', [binId]);
        if (existing.rows.length > 0) continue;

        await client.query(
          `INSERT INTO bins (id, home_id, name, location, items, notes, tags, icon, color, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            binId,
            homeId,
            bin.name,
            bin.location,
            bin.items,
            bin.notes,
            bin.tags,
            bin.icon,
            bin.color,
            req.user!.id,
            new Date(bin.createdAt),
            new Date(bin.updatedAt),
          ]
        );

        // Import photos
        for (const photo of bin.photos) {
          const photoId = photo.id || uuidv4();
          const ext = path.extname(photo.filename) || '.jpg';
          const filename = `${photoId}${ext}`;
          const storagePath = path.join(binId, filename);
          const dir = path.join(PHOTO_STORAGE_PATH, binId);

          fs.mkdirSync(dir, { recursive: true });
          const buffer = Buffer.from(photo.data, 'base64');
          fs.writeFileSync(path.join(PHOTO_STORAGE_PATH, storagePath), buffer);

          await client.query(
            `INSERT INTO photos (id, bin_id, filename, mime_type, size, storage_path, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [photoId, binId, photo.filename, photo.mimeType, buffer.length, storagePath, req.user!.id]
          );
        }

        imported++;
      }

      await client.query('COMMIT');

      res.json({
        message: 'Legacy import complete',
        imported,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Legacy import error:', err);
    res.status(500).json({ error: 'Failed to import legacy data' });
  }
});

export default router;
