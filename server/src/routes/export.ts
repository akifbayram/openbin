import { Router } from 'express';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import { query, querySync, getDb, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../lib/httpErrors.js';
import { verifyLocationMembership } from '../lib/binAccess.js';
import {
  fetchLocationBins,
  extractItemNames,
  loadBinPhotosBase64,
  loadBinPhotoMeta,
  resolveAreaSync,
  insertBinWithShortCode,
  insertBinItemsSync,
  importPhotosSync,
  type ExportBin,
  type ExportPhoto,
  type ExportData,
} from '../lib/exportHelpers.js';

const router = Router();
const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads';

router.use(authenticate);

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
router.get('/locations/:id/export', requireLocationMember(), asyncHandler(async (req, res) => {
  const locationId = req.params.id;

  const locationResult = await query('SELECT name FROM locations WHERE id = $1', [locationId]);
  if (locationResult.rows.length === 0) {
    throw new NotFoundError('Location not found');
  }

  const locationName = locationResult.rows[0].name;
  const bins = await fetchLocationBins(locationId);

  const exportBins: ExportBin[] = [];
  for (const bin of bins) {
    const photos = await loadBinPhotosBase64(bin.id);
    exportBins.push({
      id: bin.id,
      name: bin.name,
      location: bin.area_name,
      items: extractItemNames(bin.items),
      notes: bin.notes,
      tags: bin.tags,
      icon: bin.icon,
      color: bin.color,
      shortCode: bin.short_code,
      createdAt: bin.created_at,
      updatedAt: bin.updated_at,
      photos,
    });
  }

  const exportData: ExportData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    locationName,
    bins: exportBins,
  };

  res.setHeader('Content-Disposition', `attachment; filename="openbin-export-${locationId}.json"`);
  res.json(exportData);
}));

// GET /api/locations/:id/export/zip — export as ZIP with structured directories
router.get('/locations/:id/export/zip', requireLocationMember(), asyncHandler(async (req, res) => {
  const locationId = req.params.id;

  const locationResult = await query('SELECT name FROM locations WHERE id = $1', [locationId]);
  if (locationResult.rows.length === 0) {
    throw new NotFoundError('Location not found');
  }

  const locationName = locationResult.rows[0].name;
  const dbBins = await fetchLocationBins(locationId);

  const bins = [];
  const photosToInclude: Array<{ binId: string; photoId: string; filename: string; storagePath: string }> = [];

  for (const bin of dbBins) {
    const photoMeta = await loadBinPhotoMeta(bin.id);

    const photoRefs = [];
    for (const photo of photoMeta) {
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
      items: extractItemNames(bin.items),
      notes: bin.notes,
      tags: bin.tags,
      icon: bin.icon,
      color: bin.color,
      shortCode: bin.short_code,
      createdAt: bin.created_at,
      updatedAt: bin.updated_at,
      photos: photoRefs,
    });
  }

  const manifest = {
    version: 3,
    format: 'openbin-zip',
    exportedAt: new Date().toISOString(),
    locationName,
    binCount: bins.length,
    photoCount: photosToInclude.length,
  };

  // Stream ZIP response
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="openbin-export-${new Date().toISOString().slice(0, 10)}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  archive.append(JSON.stringify(bins, null, 2), { name: 'bins.json' });

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
}));

// GET /api/locations/:id/export/csv — export bins as CSV
router.get('/locations/:id/export/csv', requireLocationMember(), asyncHandler(async (req, res) => {
  const locationId = req.params.id;

  const locationResult = await query('SELECT name FROM locations WHERE id = $1', [locationId]);
  if (locationResult.rows.length === 0) {
    throw new NotFoundError('Location not found');
  }

  const bins = await fetchLocationBins(locationId);

  function csvEscape(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  const header = 'Name,Area,Items,Tags,Notes,Icon,Color,Short Code,Created,Updated';
  const rows = bins.map((bin) => {
    const items = extractItemNames(bin.items).join('; ');
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
      bin.created_at,
      bin.updated_at,
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="openbin-bins-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}));

// POST /api/locations/:id/import — import bins + photos
router.post('/locations/:id/import', express.json({ limit: '50mb' }), requireLocationMember(), asyncHandler(async (req, res) => {
  const locationId = req.params.id;
  const { bins, mode } = req.body as { bins: ExportBin[]; mode: 'merge' | 'replace' };

  if (!bins || !Array.isArray(bins)) {
    throw new ValidationError('bins array is required');
  }

  const importMode = mode || 'merge';
  const userId = req.user!.id;

  const doImport = getDb().transaction(() => {
    if (importMode === 'replace') {
      const existingPhotos = querySync<{ storage_path: string }>(
        'SELECT storage_path FROM photos WHERE bin_id IN (SELECT id FROM bins WHERE location_id = $1)',
        [locationId]
      );
      querySync('DELETE FROM bins WHERE location_id = $1', [locationId]);
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
        const existing = querySync('SELECT id FROM bins WHERE id = $1', [bin.id]);
        if (existing.rows.length > 0) {
          binsSkipped++;
          continue;
        }
      }

      const binId = bin.id || generateUuid();
      const areaId = resolveAreaSync(locationId, bin.location || '', userId);

      insertBinWithShortCode(binId, locationId, {
        name: bin.name,
        notes: bin.notes || '',
        tags: bin.tags || [],
        icon: bin.icon || '',
        color: bin.color || '',
        shortCode: bin.shortCode,
        createdAt: bin.createdAt || new Date().toISOString(),
        updatedAt: bin.updatedAt || new Date().toISOString(),
      }, areaId, userId);

      insertBinItemsSync(binId, bin.items || []);

      if (bin.photos && Array.isArray(bin.photos)) {
        photosImported += importPhotosSync(binId, bin.photos, userId);
      }

      binsImported++;
    }

    return { binsImported, binsSkipped, photosImported };
  });

  const result = doImport();

  res.json({
    binsImported: result.binsImported,
    binsSkipped: result.binsSkipped,
    photosImported: result.photosImported,
    photosSkipped: 0,
  });
}));

// POST /api/import/legacy — import legacy V1/V2 format
router.post('/import/legacy', asyncHandler(async (req, res) => {
  const { locationId, data } = req.body;

  if (!locationId) {
    throw new ValidationError('locationId is required');
  }

  if (!data) {
    throw new ValidationError('data is required');
  }

  // Verify membership
  if (!await verifyLocationMembership(locationId, req.user!.id)) {
    throw new ForbiddenError('Not a member of this location');
  }

  // Normalize legacy data to V2 format
  const legacyBins: LegacyBinV1[] = data.bins || [];
  const userId = req.user!.id;

  const normalizedBins: ExportBin[] = legacyBins.map(bin => {
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

  const doImport = getDb().transaction(() => {
    let imported = 0;

    for (const bin of normalizedBins) {
      const binId = bin.id;

      const existing = querySync('SELECT id FROM bins WHERE id = $1', [binId]);
      if (existing.rows.length > 0) continue;

      const areaId = resolveAreaSync(locationId, bin.location || '', userId);

      insertBinWithShortCode(binId, locationId, {
        name: bin.name,
        notes: bin.notes,
        tags: bin.tags,
        icon: bin.icon,
        color: bin.color,
        createdAt: bin.createdAt,
        updatedAt: bin.updatedAt,
      }, areaId, userId);

      insertBinItemsSync(binId, bin.items || []);
      importPhotosSync(binId, bin.photos, userId);

      imported++;
    }

    return imported;
  });

  const imported = doImport();

  res.json({
    message: 'Legacy import complete',
    imported,
  });
}));

export default router;
