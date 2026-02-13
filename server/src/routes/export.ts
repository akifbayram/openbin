import { Router } from 'express';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import { query, pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';

const router = Router();
const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads';

router.use(authenticate);

const SHORT_CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateShortCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += SHORT_CODE_CHARSET[Math.floor(Math.random() * SHORT_CODE_CHARSET.length)];
  }
  return code;
}

interface ExportBin {
  id: string;
  name: string;
  location: string;
  items: string[];
  notes: string;
  tags: string[];
  icon: string;
  color: string;
  shortCode?: string;
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
  locationName: string;
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

// GET /api/locations/:id/export — export all bins + photos for a location
router.get('/locations/:id/export', requireLocationMember(), async (req, res) => {
  try {
    const locationId = req.params.id;

    // Get location name
    const locationResult = await query('SELECT name FROM locations WHERE id = $1', [locationId]);
    if (locationResult.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Location not found' });
      return;
    }

    const locationName = locationResult.rows[0].name;

    // Get all non-deleted bins for this location (JOIN areas for backward-compat export)
    const binsResult = await query(
      `SELECT b.id, b.name, COALESCE(a.name, '') AS location, b.items, b.notes, b.tags, b.icon, b.color, b.short_code, b.created_at, b.updated_at
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.location_id = $1 AND b.deleted_at IS NULL ORDER BY b.updated_at DESC`,
      [locationId]
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
        shortCode: bin.short_code,
        createdAt: bin.created_at.toISOString(),
        updatedAt: bin.updated_at.toISOString(),
        photos: exportPhotos,
      });
    }

    const exportData: ExportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      locationName,
      bins: exportBins,
    };

    res.setHeader('Content-Disposition', `attachment; filename="sanduk-export-${locationId}.json"`);
    res.json(exportData);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to export data' });
  }
});

// GET /api/locations/:id/export/zip — export as ZIP with structured directories
router.get('/locations/:id/export/zip', requireLocationMember(), async (req, res) => {
  try {
    const locationId = req.params.id;

    const locationResult = await query('SELECT name FROM locations WHERE id = $1', [locationId]);
    if (locationResult.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Location not found' });
      return;
    }

    const locationName = locationResult.rows[0].name;

    const binsResult = await query(
      `SELECT b.id, b.name, COALESCE(a.name, '') AS area_name, b.items, b.notes, b.tags, b.icon, b.color, b.short_code, b.created_at, b.updated_at
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.location_id = $1 AND b.deleted_at IS NULL ORDER BY b.updated_at DESC`,
      [locationId]
    );

    // Build manifest and bins JSON (without photo data)
    const bins = [];
    const photosToInclude: Array<{ binId: string; photoId: string; filename: string; storagePath: string }> = [];

    for (const bin of binsResult.rows) {
      const photosResult = await query(
        'SELECT id, filename, mime_type, storage_path FROM photos WHERE bin_id = $1',
        [bin.id]
      );

      const photoRefs = [];
      for (const photo of photosResult.rows) {
        const ext = path.extname(photo.filename || '.jpg').toLowerCase();
        const zipFilename = `${photo.id}${ext}`;
        photoRefs.push({
          id: photo.id,
          filename: photo.filename,
          mimeType: photo.mime_type,
          zipPath: `photos/${zipFilename}`,
        });
        photosToInclude.push({
          binId: bin.id,
          photoId: photo.id,
          filename: zipFilename,
          storagePath: photo.storage_path,
        });
      }

      bins.push({
        id: bin.id,
        name: bin.name,
        location: bin.area_name,
        items: bin.items,
        notes: bin.notes,
        tags: bin.tags,
        icon: bin.icon,
        color: bin.color,
        shortCode: bin.short_code,
        createdAt: bin.created_at.toISOString(),
        updatedAt: bin.updated_at.toISOString(),
        photos: photoRefs,
      });
    }

    const manifest = {
      version: 3,
      format: 'sanduk-zip',
      exportedAt: new Date().toISOString(),
      locationName,
      binCount: bins.length,
      photoCount: photosToInclude.length,
    };

    // Stream ZIP response
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="sanduk-export-${new Date().toISOString().slice(0, 10)}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.append(JSON.stringify(bins, null, 2), { name: 'bins.json' });

    // Add photo files
    for (const photo of photosToInclude) {
      const filePath = path.join(PHOTO_STORAGE_PATH, photo.storagePath);
      try {
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: `photos/${photo.filename}` });
        }
      } catch {
        // Skip unreadable photos
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('ZIP export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to export ZIP' });
    }
  }
});

// GET /api/locations/:id/export/csv — export bins as CSV
router.get('/locations/:id/export/csv', requireLocationMember(), async (req, res) => {
  try {
    const locationId = req.params.id;

    const locationResult = await query('SELECT name FROM locations WHERE id = $1', [locationId]);
    if (locationResult.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Location not found' });
      return;
    }

    const binsResult = await query(
      `SELECT b.name, COALESCE(a.name, '') AS area_name, b.items, b.notes, b.tags, b.icon, b.color, b.short_code, b.created_at, b.updated_at
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.location_id = $1 AND b.deleted_at IS NULL ORDER BY b.name ASC`,
      [locationId]
    );

    function csvEscape(val: string): string {
      if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }

    const header = 'Name,Area,Items,Tags,Notes,Icon,Color,Short Code,Created,Updated';
    const rows = binsResult.rows.map((bin) => {
      const items = Array.isArray(bin.items) ? bin.items.join('; ') : '';
      const tags = Array.isArray(bin.tags) ? bin.tags.join('; ') : '';
      return [
        csvEscape(bin.name),
        csvEscape(bin.area_name),
        csvEscape(items),
        csvEscape(tags),
        csvEscape(bin.notes || ''),
        csvEscape(bin.icon || ''),
        csvEscape(bin.color || ''),
        csvEscape(bin.short_code || ''),
        bin.created_at.toISOString(),
        bin.updated_at.toISOString(),
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sanduk-bins-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to export CSV' });
  }
});

// POST /api/locations/:id/import — import bins + photos
router.post('/locations/:id/import', express.json({ limit: '50mb' }), requireLocationMember(), async (req, res) => {
  try {
    const locationId = req.params.id;
    const { bins, mode } = req.body as { bins: ExportBin[]; mode: 'merge' | 'replace' };

    if (!bins || !Array.isArray(bins)) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'bins array is required' });
      return;
    }

    const importMode = mode || 'merge';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (importMode === 'replace') {
        // Get existing photos to clean up files
        const existingPhotos = await client.query(
          'SELECT storage_path FROM photos WHERE bin_id IN (SELECT id FROM bins WHERE location_id = $1)',
          [locationId]
        );
        // Delete existing bins (cascade deletes photos in DB)
        await client.query('DELETE FROM bins WHERE location_id = $1', [locationId]);
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

        // Resolve area from location string
        let areaId: string | null = null;
        const locationStr = (bin.location || '').trim();
        if (locationStr) {
          // Insert or find existing area
          await client.query(
            'INSERT INTO areas (location_id, name, created_by) VALUES ($1, $2, $3) ON CONFLICT (location_id, name) DO NOTHING',
            [locationId, locationStr, req.user!.id]
          );
          const areaResult = await client.query(
            'SELECT id FROM areas WHERE location_id = $1 AND name = $2',
            [locationId, locationStr]
          );
          if (areaResult.rows.length > 0) {
            areaId = areaResult.rows[0].id;
          }
        }

        // Generate short_code with retry on collision
        let shortCodeInserted = false;
        for (let attempt = 0; attempt <= 10; attempt++) {
          const code = attempt === 0 && bin.shortCode ? bin.shortCode : generateShortCode();
          try {
            await client.query(
              `INSERT INTO bins (id, location_id, name, area_id, items, notes, tags, icon, color, short_code, created_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                binId,
                locationId,
                bin.name,
                areaId,
                bin.items || [],
                bin.notes || '',
                bin.tags || [],
                bin.icon || '',
                bin.color || '',
                code,
                req.user!.id,
                bin.createdAt ? new Date(bin.createdAt) : new Date(),
                bin.updatedAt ? new Date(bin.updatedAt) : new Date(),
              ]
            );
            shortCodeInserted = true;
            break;
          } catch (err: unknown) {
            const pgErr = err as { code?: string; constraint?: string };
            if (pgErr.code === '23505' && pgErr.constraint === 'bins_short_code_key' && attempt < 10) {
              continue;
            }
            throw err;
          }
        }
        if (!shortCodeInserted) throw new Error('Failed to generate unique short code');

        // Import photos
        if (bin.photos && Array.isArray(bin.photos)) {
          for (const photo of bin.photos) {
            const buffer = Buffer.from(photo.data, 'base64');
            if (buffer.length > 10 * 1024 * 1024) continue; // Skip oversized photos

            const photoId = uuidv4(); // Always generate new ID
            const photoExt = path.extname(photo.filename || '').toLowerCase();
            const ALLOWED_PHOTO_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
            const safeExt = ALLOWED_PHOTO_EXTS.includes(photoExt) ? photoExt : '.jpg';
            const safeFilename = `${photoId}${safeExt}`;
            const storagePath = path.join(binId, safeFilename);

            // Validate no path traversal
            if (storagePath.includes('..')) continue;

            const dir = path.join(PHOTO_STORAGE_PATH, binId);

            fs.mkdirSync(dir, { recursive: true });
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
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to import data' });
  }
});

// POST /api/import/legacy — import legacy V1/V2 format
router.post('/import/legacy', async (req, res) => {
  try {
    const { locationId, data } = req.body;

    if (!locationId) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'locationId is required' });
      return;
    }

    if (!data) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'data is required' });
      return;
    }

    // Verify membership
    const memberResult = await query(
      'SELECT id FROM location_members WHERE location_id = $1 AND user_id = $2',
      [locationId, req.user!.id]
    );

    if (memberResult.rows.length === 0) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
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

        // Resolve area from location string
        let legacyAreaId: string | null = null;
        const legacyLocation = (bin.location || '').trim();
        if (legacyLocation) {
          await client.query(
            'INSERT INTO areas (location_id, name, created_by) VALUES ($1, $2, $3) ON CONFLICT (location_id, name) DO NOTHING',
            [locationId, legacyLocation, req.user!.id]
          );
          const areaResult = await client.query(
            'SELECT id FROM areas WHERE location_id = $1 AND name = $2',
            [locationId, legacyLocation]
          );
          if (areaResult.rows.length > 0) {
            legacyAreaId = areaResult.rows[0].id;
          }
        }

        // Generate short_code with retry on collision
        let legacyCodeInserted = false;
        for (let attempt = 0; attempt <= 10; attempt++) {
          const code = generateShortCode();
          try {
            await client.query(
              `INSERT INTO bins (id, location_id, name, area_id, items, notes, tags, icon, color, short_code, created_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                binId,
                locationId,
                bin.name,
                legacyAreaId,
                bin.items,
                bin.notes,
                bin.tags,
                bin.icon,
                bin.color,
                code,
                req.user!.id,
                new Date(bin.createdAt),
                new Date(bin.updatedAt),
              ]
            );
            legacyCodeInserted = true;
            break;
          } catch (err: unknown) {
            const pgErr = err as { code?: string; constraint?: string };
            if (pgErr.code === '23505' && pgErr.constraint === 'bins_short_code_key' && attempt < 10) {
              continue;
            }
            throw err;
          }
        }
        if (!legacyCodeInserted) throw new Error('Failed to generate unique short code');

        // Import photos
        for (const photo of bin.photos) {
          const buffer = Buffer.from(photo.data, 'base64');
          if (buffer.length > 10 * 1024 * 1024) continue; // Skip oversized photos

          const photoId = uuidv4(); // Always generate new ID
          const photoExt = path.extname(photo.filename || '').toLowerCase();
          const ALLOWED_PHOTO_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
          const safeExt = ALLOWED_PHOTO_EXTS.includes(photoExt) ? photoExt : '.jpg';
          const safeFilename = `${photoId}${safeExt}`;
          const storagePath = path.join(binId, safeFilename);

          // Validate no path traversal
          if (storagePath.includes('..')) continue;

          const dir = path.join(PHOTO_STORAGE_PATH, binId);

          fs.mkdirSync(dir, { recursive: true });
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
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to import legacy data' });
  }
});

export default router;
