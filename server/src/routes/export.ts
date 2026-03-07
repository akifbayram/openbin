import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import express, { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, query, querySync } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { verifyLocationMembership } from '../lib/binAccess.js';
import { config } from '../lib/config.js';
import {
  buildFieldIdToNameMap,
  type ExportBin,
  type ExportData,
  type ExportPhoto,
  extractItemsWithQuantity,
  fetchLocationBins,
  fetchLocationFieldDefs,
  fetchLocationTagColors,
  importPhotosSync,
  importTagColorsSync,
  insertBinItemsSync,
  insertBinWithShortCode,
  loadBinPhotoMeta,
  loadBinPhotosBase64,
  mapCustomFieldsToIds,
  mapCustomFieldsToNames,
  resolveAreaSync,
  resolveCustomFieldDefsSync,
} from '../lib/exportHelpers.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { safePath } from '../lib/pathSafety.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';

const router = Router();
const PHOTO_STORAGE_PATH = config.photoStoragePath;

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
  const [bins, tagColors, fieldDefs, fieldIdToName] = await Promise.all([
    fetchLocationBins(locationId),
    fetchLocationTagColors(locationId),
    fetchLocationFieldDefs(locationId),
    buildFieldIdToNameMap(locationId),
  ]);

  const exportBins: ExportBin[] = [];
  for (const bin of bins) {
    const photos = await loadBinPhotosBase64(bin.id);
    // Map custom field values from fieldId-keyed to fieldName-keyed for portability
    const customFields =
      bin.custom_fields && typeof bin.custom_fields === 'object' && Object.keys(bin.custom_fields).length > 0
        ? mapCustomFieldsToNames(bin.custom_fields as Record<string, string>, fieldIdToName)
        : undefined;

    exportBins.push({
      id: bin.id,
      name: bin.name,
      location: bin.area_name,
      items: extractItemsWithQuantity(bin.items),
      notes: bin.notes,
      tags: bin.tags,
      icon: bin.icon,
      color: bin.color,
      cardStyle: bin.card_style || undefined,
      visibility: bin.visibility !== 'location' ? bin.visibility : undefined,
      customFields,
      shortCode: bin.id,
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
    tagColors: tagColors.length > 0 ? tagColors : undefined,
    customFieldDefinitions: fieldDefs.length > 0 ? fieldDefs : undefined,
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
  const [dbBins, tagColors, fieldDefs, fieldIdToName] = await Promise.all([
    fetchLocationBins(locationId),
    fetchLocationTagColors(locationId),
    fetchLocationFieldDefs(locationId),
    buildFieldIdToNameMap(locationId),
  ]);

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

    const customFields =
      bin.custom_fields && typeof bin.custom_fields === 'object' && Object.keys(bin.custom_fields).length > 0
        ? mapCustomFieldsToNames(bin.custom_fields as Record<string, string>, fieldIdToName)
        : undefined;

    bins.push({
      id: bin.id,
      name: bin.name,
      location: bin.area_name,
      items: extractItemsWithQuantity(bin.items),
      notes: bin.notes,
      tags: bin.tags,
      icon: bin.icon,
      color: bin.color,
      cardStyle: bin.card_style || undefined,
      visibility: bin.visibility !== 'location' ? bin.visibility : undefined,
      customFields,
      shortCode: bin.id,
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
    tagColors: tagColors.length > 0 ? tagColors : undefined,
    customFieldDefinitions: fieldDefs.length > 0 ? fieldDefs : undefined,
  };

  // Stream ZIP response
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="openbin-export-${new Date().toISOString().slice(0, 10)}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  archive.append(JSON.stringify(bins, null, 2), { name: 'bins.json' });

  for (const photo of photosToInclude) {
    const filePath = safePath(PHOTO_STORAGE_PATH, photo.storagePath);
    if (!filePath) continue;
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

// GET /api/locations/:id/export/csv — export bins as CSV (one row per item)
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

  const header = 'Bin Name,Area,Item,Quantity,Tags';
  const rows: string[] = [];

  for (const bin of bins) {
    const items = extractItemsWithQuantity(bin.items);
    const tags = Array.isArray(bin.tags) ? bin.tags.join(',') : '';
    const binName = csvEscape(bin.name);
    const area = csvEscape(bin.area_name);
    const tagsField = csvEscape(tags);

    if (items.length === 0) {
      rows.push([binName, area, '', '', tagsField].join(','));
    } else {
      for (const item of items) {
        const name = typeof item === 'string' ? item : item.name;
        const qty = typeof item === 'string' ? '' : String(item.quantity);
        rows.push([binName, area, csvEscape(name), qty, tagsField].join(','));
      }
    }
  }

  const csv = [header, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="openbin-inventory-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}));

// POST /api/locations/:id/import — import bins + photos
router.post('/locations/:id/import', express.json({ limit: '50mb' }), requireLocationMember(), asyncHandler(async (req, res) => {
  const locationId = req.params.id;
  const { bins, mode, tagColors, customFieldDefinitions } = req.body as {
    bins: ExportBin[];
    mode: 'merge' | 'replace';
    tagColors?: Array<{ tag: string; color: string }>;
    customFieldDefinitions?: Array<{ name: string; position: number }>;
  };

  if (!bins || !Array.isArray(bins)) {
    throw new ValidationError('bins array is required');
  }
  if (bins.length > 2000) {
    throw new ValidationError('Too many bins in import (max 2000)');
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
          const filePath = safePath(PHOTO_STORAGE_PATH, photo.storage_path);
          if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch { /* ignore */ }
      }
    }

    // Import tag colors if provided
    if (tagColors && Array.isArray(tagColors)) {
      importTagColorsSync(locationId, tagColors);
    }

    // Resolve custom field definitions (create if missing) and build name→id map
    let fieldNameToId: Map<string, string> | undefined;
    if (customFieldDefinitions && Array.isArray(customFieldDefinitions)) {
      fieldNameToId = resolveCustomFieldDefsSync(locationId, customFieldDefinitions);
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

      const areaId = resolveAreaSync(locationId, bin.location || '', userId);

      // Map name-keyed custom fields to fieldId-keyed if we have definitions
      let resolvedCustomFields = bin.customFields;
      if (resolvedCustomFields && fieldNameToId && fieldNameToId.size > 0) {
        resolvedCustomFields = mapCustomFieldsToIds(resolvedCustomFields, fieldNameToId);
      }

      const binId = insertBinWithShortCode('', locationId, {
        name: bin.name,
        notes: bin.notes || '',
        tags: bin.tags || [],
        icon: bin.icon || '',
        color: bin.color || '',
        cardStyle: bin.cardStyle,
        visibility: bin.visibility,
        customFields: resolvedCustomFields,
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
      const areaId = resolveAreaSync(locationId, bin.location || '', userId);

      const binId = insertBinWithShortCode('', locationId, {
        name: bin.name,
        notes: bin.notes,
        tags: bin.tags,
        icon: bin.icon,
        color: bin.color,
        cardStyle: bin.cardStyle,
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
