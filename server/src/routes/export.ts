import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import archiver from 'archiver';
import express, { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getDb, query, querySync } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireMemberOrAbove, verifyLocationMembership } from '../lib/binAccess.js';
import { config } from '../lib/config.js';
import { parseCSV } from '../lib/csvParser.js';
import {
  buildAreaPathMap,
  buildFieldIdToNameMap,
  type ExportArea,
  type ExportBin,
  type ExportData,
  type ExportLocationSettings,
  type ExportMember,
  type ExportPhoto,
  type ExportPinnedBin,
  type ExportSavedView,
  extractItemsWithQuantity,
  fetchLocationBins,
  fetchLocationFieldDefs,
  fetchLocationMembers,
  fetchLocationPinnedBins,
  fetchLocationSavedViews,
  fetchLocationSettings,
  fetchLocationTagColors,
  fetchTrashedBins,
  importAreasSync,
  importLocationSettingsSync,
  importMembersSync,
  importPhotosSync,
  importPinnedBinsSync,
  importSavedViewsSync,
  importTagColorsSync,
  insertBinItemsSync,
  insertBinWithShortCode,
  loadBinPhotoMeta,
  loadBinPhotosBase64,
  mapCustomFieldsToIds,
  mapCustomFieldsToNames,
  resolveAreaSync,
  resolveCreatedBySync,
  resolveCustomFieldDefsSync,
} from '../lib/exportHelpers.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { safePath } from '../lib/pathSafety.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';

const router = Router();
const PHOTO_STORAGE_PATH = config.photoStoragePath;

interface DryRunBin {
  id?: string;
  name: string;
  items?: unknown[];
  tags?: string[];
}

function buildDryRunPreview(
  bins: DryRunBin[],
  importMode: 'merge' | 'replace',
) {
  const toCreate: { name: string; itemCount: number; tags: string[] }[] = [];
  const toSkip: { name: string; reason: string }[] = [];
  let totalItems = 0;

  // Batch-fetch existing IDs in one query when merge mode
  let existingIds: Set<string> | undefined;
  if (importMode === 'merge') {
    const ids = bins.map(b => b.id).filter((id): id is string => !!id);
    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const rows = querySync<{ id: string }>(
        `SELECT id FROM bins WHERE id IN (${placeholders})`,
        ids,
      );
      existingIds = new Set(rows.rows.map(r => r.id));
    } else {
      existingIds = new Set();
    }
  }

  for (const bin of bins) {
    const items = bin.items || [];
    totalItems += items.length;

    if (existingIds && bin.id && existingIds.has(bin.id)) {
      toSkip.push({ name: bin.name, reason: 'already exists' });
      continue;
    }

    toCreate.push({ name: bin.name, itemCount: items.length, tags: bin.tags || [] });
  }

  return { preview: true as const, toCreate, toSkip, totalBins: bins.length, totalItems };
}

function lookupAreaSync(locationId: string, areaPath: string): string | null {
  const parts = areaPath.trim().split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let parentId: string | null = null;
  let lastId: string | null = null;

  for (const part of parts) {
    const q = parentId === null
      ? 'SELECT id FROM areas WHERE location_id = $1 AND name = $2 AND parent_id IS NULL'
      : 'SELECT id FROM areas WHERE location_id = $1 AND name = $2 AND parent_id = $3';
    const params = parentId === null ? [locationId, part] : [locationId, part, parentId];
    const found = querySync(q, params);
    if (found.rows.length > 0) {
      lastId = found.rows[0].id as string;
      parentId = lastId;
    } else {
      return null;
    }
  }

  return lastId;
}

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
  const [bins, trashedBinsRaw, tagColors, fieldDefs, fieldIdToName, areaPathMap, locationSettings, pinnedBins, savedViews, members] = await Promise.all([
    fetchLocationBins(locationId),
    fetchTrashedBins(locationId),
    fetchLocationTagColors(locationId),
    fetchLocationFieldDefs(locationId),
    buildFieldIdToNameMap(locationId),
    buildAreaPathMap(locationId),
    fetchLocationSettings(locationId),
    fetchLocationPinnedBins(locationId),
    fetchLocationSavedViews(locationId),
    fetchLocationMembers(locationId),
  ]);

  function buildExportBin(bin: Record<string, unknown>, includeTrashed?: boolean): ExportBin {
    const customFields =
      bin.custom_fields && typeof bin.custom_fields === 'object' && Object.keys(bin.custom_fields as object).length > 0
        ? mapCustomFieldsToNames(bin.custom_fields as Record<string, string>, fieldIdToName)
        : undefined;
    const areaInfo = bin.area_id ? areaPathMap.get(bin.area_id as string) : undefined;
    const areaPath = areaInfo?.path || (bin.area_name as string);

    return {
      id: bin.id as string,
      name: bin.name as string,
      location: areaPath,
      items: extractItemsWithQuantity(bin.items),
      notes: bin.notes as string,
      tags: bin.tags as string[],
      icon: bin.icon as string,
      color: bin.color as string,
      cardStyle: (bin.card_style as string) || undefined,
      visibility: bin.visibility !== 'location' ? (bin.visibility as 'private') : undefined,
      customFields,
      shortCode: bin.id as string,
      createdBy: (bin.created_by as string) || undefined,
      deletedAt: includeTrashed ? (bin.deleted_at as string) : undefined,
      createdAt: bin.created_at as string,
      updatedAt: bin.updated_at as string,
      photos: [], // filled below
    };
  }

  const exportBins: ExportBin[] = [];
  for (const bin of bins) {
    const entry = buildExportBin(bin);
    entry.photos = await loadBinPhotosBase64(bin.id);
    exportBins.push(entry);
  }

  const exportTrashedBins: ExportBin[] = [];
  for (const bin of trashedBinsRaw) {
    const entry = buildExportBin(bin, true);
    entry.photos = await loadBinPhotosBase64(bin.id);
    exportTrashedBins.push(entry);
  }

  // All area paths (including empty areas with no bins)
  const allAreaPaths: ExportArea[] = Array.from(areaPathMap.values()).map(a => ({ path: a.path, createdBy: a.createdBy || undefined }));

  const exportData: ExportData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    locationName,
    locationSettings,
    bins: exportBins,
    trashedBins: exportTrashedBins.length > 0 ? exportTrashedBins : undefined,
    areas: allAreaPaths.length > 0 ? allAreaPaths : undefined,
    tagColors: tagColors.length > 0 ? tagColors : undefined,
    customFieldDefinitions: fieldDefs.length > 0 ? fieldDefs : undefined,
    pinnedBins: pinnedBins.length > 0 ? pinnedBins : undefined,
    savedViews: savedViews.length > 0 ? savedViews : undefined,
    members: members.length > 0 ? members : undefined,
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
  const [dbBins, trashedBinsRaw, tagColors, fieldDefs, fieldIdToName, areaPathMap, locationSettings, pinnedBins, savedViews, members] = await Promise.all([
    fetchLocationBins(locationId),
    fetchTrashedBins(locationId),
    fetchLocationTagColors(locationId),
    fetchLocationFieldDefs(locationId),
    buildFieldIdToNameMap(locationId),
    buildAreaPathMap(locationId),
    fetchLocationSettings(locationId),
    fetchLocationPinnedBins(locationId),
    fetchLocationSavedViews(locationId),
    fetchLocationMembers(locationId),
  ]);

  function buildZipBinEntry(bin: Record<string, unknown>, includeTrashed?: boolean) {
    const customFields =
      bin.custom_fields && typeof bin.custom_fields === 'object' && Object.keys(bin.custom_fields as object).length > 0
        ? mapCustomFieldsToNames(bin.custom_fields as Record<string, string>, fieldIdToName)
        : undefined;
    const areaInfo = bin.area_id ? areaPathMap.get(bin.area_id as string) : undefined;
    const areaPath = areaInfo?.path || (bin.area_name as string);

    return {
      id: bin.id as string,
      name: bin.name as string,
      location: areaPath,
      items: extractItemsWithQuantity(bin.items),
      notes: bin.notes as string,
      tags: bin.tags as string[],
      icon: bin.icon as string,
      color: bin.color as string,
      cardStyle: (bin.card_style as string) || undefined,
      visibility: bin.visibility !== 'location' ? (bin.visibility as string) : undefined,
      customFields,
      shortCode: bin.id as string,
      createdBy: (bin.created_by as string) || undefined,
      deletedAt: includeTrashed ? (bin.deleted_at as string) : undefined,
      createdAt: bin.created_at as string,
      updatedAt: bin.updated_at as string,
      photos: [] as Array<{ id: string; filename: string; mimeType: string; zipPath: string; createdBy?: string; createdAt?: string }>,
    };
  }

  const bins = [];
  const photosToInclude: Array<{ binId: string; photoId: string; filename: string; storagePath: string }> = [];

  async function collectPhotos(binId: string, entry: ReturnType<typeof buildZipBinEntry>) {
    const photoMeta = await loadBinPhotoMeta(binId);
    for (const photo of photoMeta) {
      const ext = path.extname(photo.filename || '.jpg').toLowerCase();
      const zipFilename = `${photo.id}${ext}`;
      entry.photos.push({
        id: photo.id,
        filename: photo.filename,
        mimeType: photo.mime_type,
        zipPath: `photos/${zipFilename}`,
        createdBy: photo.created_by || undefined,
        createdAt: photo.created_at || undefined,
      });
      photosToInclude.push({ binId, photoId: photo.id, filename: zipFilename, storagePath: photo.storage_path });
    }
  }

  for (const bin of dbBins) {
    const entry = buildZipBinEntry(bin);
    await collectPhotos(bin.id, entry);
    bins.push(entry);
  }

  const trashedBinEntries = [];
  for (const bin of trashedBinsRaw) {
    const entry = buildZipBinEntry(bin, true);
    await collectPhotos(bin.id, entry);
    trashedBinEntries.push(entry);
  }

  const allAreaPaths = Array.from(areaPathMap.values()).map(a => ({ path: a.path, createdBy: a.createdBy || undefined }));

  const manifest = {
    version: 3,
    format: 'openbin-zip',
    exportedAt: new Date().toISOString(),
    locationName,
    locationSettings,
    binCount: bins.length,
    trashedBinCount: trashedBinEntries.length,
    photoCount: photosToInclude.length,
    areas: allAreaPaths.length > 0 ? allAreaPaths : undefined,
    tagColors: tagColors.length > 0 ? tagColors : undefined,
    customFieldDefinitions: fieldDefs.length > 0 ? fieldDefs : undefined,
    pinnedBins: pinnedBins.length > 0 ? pinnedBins : undefined,
    savedViews: savedViews.length > 0 ? savedViews : undefined,
    members: members.length > 0 ? members : undefined,
  };

  // Stream ZIP response
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="openbin-export-${new Date().toISOString().slice(0, 10)}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  archive.append(JSON.stringify(bins, null, 2), { name: 'bins.json' });
  if (trashedBinEntries.length > 0) {
    archive.append(JSON.stringify(trashedBinEntries, null, 2), { name: 'trashed-bins.json' });
  }

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

  const [bins, areaPathMap] = await Promise.all([
    fetchLocationBins(locationId),
    buildAreaPathMap(locationId),
  ]);

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
    const areaPath = bin.area_id ? (areaPathMap.get(bin.area_id)?.path || bin.area_name) : bin.area_name;
    const area = csvEscape(areaPath);
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
  const {
    bins, trashedBins, mode, tagColors, customFieldDefinitions,
    locationSettings, areas, pinnedBins, savedViews, members, dryRun,
  } = req.body as {
    bins: ExportBin[];
    trashedBins?: ExportBin[];
    mode: 'merge' | 'replace';
    tagColors?: Array<{ tag: string; color: string }>;
    customFieldDefinitions?: Array<{ name: string; position: number }>;
    locationSettings?: ExportLocationSettings;
    areas?: ExportArea[];
    pinnedBins?: ExportPinnedBin[];
    savedViews?: ExportSavedView[];
    members?: ExportMember[];
    dryRun?: boolean;
  };

  if (!bins || !Array.isArray(bins)) {
    throw new ValidationError('bins array is required');
  }
  const totalBins = bins.length + (trashedBins?.length || 0);
  if (totalBins > 2000) {
    throw new ValidationError('Too many bins in import (max 2000)');
  }

  const importMode = mode || 'merge';
  const userId = req.user!.id;

  if (dryRun) {
    res.json(buildDryRunPreview(bins, importMode));
    return;
  }

  // Check if importing user is admin (needed for settings and members)
  const memberRow = querySync<{ role: string }>(
    'SELECT role FROM location_members WHERE location_id = $1 AND user_id = $2',
    [locationId, userId]
  );
  const isAdmin = memberRow.rows.length > 0 && memberRow.rows[0].role === 'admin';

  const doImport = getDb().transaction(() => {
    // 1. Replace-mode cleanup
    if (importMode === 'replace') {
      const existingPhotos = querySync<{ storage_path: string }>(
        'SELECT storage_path FROM photos WHERE bin_id IN (SELECT id FROM bins WHERE location_id = $1)',
        [locationId]
      );
      querySync('DELETE FROM bins WHERE location_id = $1', [locationId]);
      querySync('DELETE FROM areas WHERE location_id = $1', [locationId]);
      for (const photo of existingPhotos.rows) {
        try {
          const filePath = safePath(PHOTO_STORAGE_PATH, photo.storage_path);
          if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch { /* ignore */ }
      }
    }

    // 2. Location settings (replace mode only, admin only)
    let settingsApplied = false;
    if (locationSettings && importMode === 'replace' && isAdmin) {
      importLocationSettingsSync(locationId, locationSettings);
      settingsApplied = true;
    }

    // 3. Members (admin only)
    let membersImported = 0;
    if (members && Array.isArray(members) && isAdmin) {
      membersImported = importMembersSync(locationId, members);
    }

    // 4. Tag colors
    if (tagColors && Array.isArray(tagColors)) {
      importTagColorsSync(locationId, tagColors);
    }

    // 5. Custom field definitions
    let fieldNameToId: Map<string, string> | undefined;
    if (customFieldDefinitions && Array.isArray(customFieldDefinitions)) {
      fieldNameToId = resolveCustomFieldDefsSync(locationId, customFieldDefinitions);
    }

    // 6. Areas (before bins so paths exist)
    let areasImported = 0;
    if (areas && Array.isArray(areas)) {
      areasImported = importAreasSync(locationId, areas, userId);
    }

    // Helper to import a single bin
    const oldToNewBinId = new Map<string, string>();

    function importSingleBin(bin: ExportBin, opts?: { deletedAt?: string | null }): boolean {
      if (importMode === 'merge') {
        const existing = querySync('SELECT id FROM bins WHERE id = $1', [bin.id]);
        if (existing.rows.length > 0) return false;
      }

      const areaId = resolveAreaSync(locationId, bin.location || '', userId);
      let resolvedCustomFields = bin.customFields;
      if (resolvedCustomFields && fieldNameToId && fieldNameToId.size > 0) {
        resolvedCustomFields = mapCustomFieldsToIds(resolvedCustomFields, fieldNameToId);
      }

      const resolvedCreatedBy = resolveCreatedBySync(bin.createdBy, userId);
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
        deletedAt: opts?.deletedAt,
        createdAt: bin.createdAt || new Date().toISOString(),
        updatedAt: bin.updatedAt || new Date().toISOString(),
      }, areaId, resolvedCreatedBy);

      oldToNewBinId.set(bin.id, binId);
      insertBinItemsSync(binId, bin.items || []);
      return true;
    }

    // 7. Active bins
    let binsImported = 0;
    let binsSkipped = 0;
    let photosImported = 0;

    for (const bin of bins) {
      if (importSingleBin(bin)) {
        const newBinId = oldToNewBinId.get(bin.id)!;
        if (bin.photos && Array.isArray(bin.photos)) {
          photosImported += importPhotosSync(newBinId, bin.photos, userId);
        }
        binsImported++;
      } else {
        binsSkipped++;
      }
    }

    // 8. Trashed bins
    let trashedBinsImported = 0;
    if (trashedBins && Array.isArray(trashedBins)) {
      for (const bin of trashedBins) {
        if (importSingleBin(bin, { deletedAt: bin.deletedAt })) {
          const newBinId = oldToNewBinId.get(bin.id)!;
          if (bin.photos && Array.isArray(bin.photos)) {
            photosImported += importPhotosSync(newBinId, bin.photos, userId);
          }
          trashedBinsImported++;
        }
      }
    }

    // 9. Pinned bins (after all bins are imported)
    let pinsImported = 0;
    if (pinnedBins && Array.isArray(pinnedBins)) {
      pinsImported = importPinnedBinsSync(pinnedBins, oldToNewBinId);
    }

    // 10. Saved views
    let viewsImported = 0;
    if (savedViews && Array.isArray(savedViews)) {
      viewsImported = importSavedViewsSync(savedViews);
    }

    return { binsImported, binsSkipped, trashedBinsImported, photosImported, areasImported, pinsImported, viewsImported, membersImported, settingsApplied };
  });

  const result = doImport();

  res.json({
    binsImported: result.binsImported,
    binsSkipped: result.binsSkipped,
    trashedBinsImported: result.trashedBinsImported,
    photosImported: result.photosImported,
    photosSkipped: 0,
    areasImported: result.areasImported,
    pinsImported: result.pinsImported,
    viewsImported: result.viewsImported,
    membersImported: result.membersImported,
    settingsApplied: result.settingsApplied,
  });
}));

// POST /api/locations/:id/import/csv — import bins from CSV file
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');

router.post('/locations/:id/import/csv', csvUpload, requireLocationMember(), asyncHandler(async (req, res) => {
  const locationId = req.params.id;
  const userId = req.user!.id;

  await requireMemberOrAbove(locationId, userId, 'import CSV');

  if (!req.file) {
    throw new ValidationError('CSV file is required');
  }

  const text = req.file.buffer.toString('utf-8');
  const rows = parseCSV(text);
  if (rows.length < 2) {
    throw new ValidationError('CSV file must have a header row and at least one data row');
  }

  const header = rows[0].map(h => h.trim().toLowerCase());
  const isRoundTrip =
    header.length === 5 &&
    header[0] === 'bin name' &&
    header[1] === 'area' &&
    header[2] === 'item' &&
    header[3] === 'quantity' &&
    header[4] === 'tags';
  const isOneBinPerRow =
    header.length === 4 &&
    (header[0] === 'bin name' || header[0] === 'name') &&
    header[1] === 'area' &&
    header[2] === 'items' &&
    header[3] === 'tags';

  if (!isRoundTrip && !isOneBinPerRow) {
    throw new ValidationError(
      'CSV header must be "Bin Name,Area,Item,Quantity,Tags" or "Bin Name,Area,Items,Tags"'
    );
  }

  const importMode = (req.body?.mode === 'replace' ? 'replace' : 'merge') as 'merge' | 'replace';

  // Group rows into bins
  interface PendingBin {
    name: string;
    area: string;
    items: Array<{ name: string; quantity: number | null }>;
    tags: string[];
  }

  const pendingBins: PendingBin[] = [];

  if (isRoundTrip) {
    // Group consecutive rows with same Bin Name + Area
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 5) continue;
      const binName = row[0].trim();
      const area = row[1].trim();
      const itemName = row[2].trim();
      const qtyRaw = row[3].trim();
      const tagsRaw = row[4].trim();

      if (!binName) continue;

      const quantity = qtyRaw ? Number.parseInt(qtyRaw, 10) : null;
      const item = itemName ? { name: itemName, quantity: Number.isNaN(quantity) ? null : quantity } : null;

      // Check if this row belongs to the same bin as previous
      const prev = pendingBins.length > 0 ? pendingBins[pendingBins.length - 1] : null;
      if (prev && prev.name === binName && prev.area === area) {
        if (item) prev.items.push(item);
      } else {
        const tags = tagsRaw
          ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
          : [];
        pendingBins.push({
          name: binName,
          area,
          items: item ? [item] : [],
          tags,
        });
      }
    }
  } else {
    // One-bin-per-row format
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 4) continue;
      const binName = row[0].trim();
      const area = row[1].trim();
      const itemsRaw = row[2].trim();
      const tagsRaw = row[3].trim();

      if (!binName) continue;

      const items: Array<{ name: string; quantity: number | null }> = [];
      if (itemsRaw) {
        for (const part of itemsRaw.split(';')) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          // Parse "name (qty)" or "name x qty" patterns
          const matchParen = trimmed.match(/^(.+?)\s*\((\d+)\)\s*$/);
          const matchX = trimmed.match(/^(.+?)\s+x\s*(\d+)\s*$/i);
          if (matchParen) {
            items.push({ name: matchParen[1].trim(), quantity: Number.parseInt(matchParen[2], 10) });
          } else if (matchX) {
            items.push({ name: matchX[1].trim(), quantity: Number.parseInt(matchX[2], 10) });
          } else {
            items.push({ name: trimmed, quantity: null });
          }
        }
      }

      const tags = tagsRaw
        ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
        : [];
      pendingBins.push({ name: binName, area, items, tags });
    }
  }

  if (pendingBins.length > 2000) {
    throw new ValidationError('Too many bins in CSV import (max 2000)');
  }

  const dryRun = req.body?.dryRun === 'true' || req.body?.dryRun === true;

  if (dryRun) {
    const toCreate: { name: string; itemCount: number; tags: string[] }[] = [];
    const toSkip: { name: string; reason: string }[] = [];
    let totalItems = 0;
    const areaCache = new Map<string, string | null>();

    for (const bin of pendingBins) {
      totalItems += bin.items.length;

      if (importMode === 'merge') {
        let areaId = areaCache.get(bin.area);
        if (areaId === undefined) {
          areaId = lookupAreaSync(locationId, bin.area);
          areaCache.set(bin.area, areaId);
        }

        const areaClause = areaId ? 'AND area_id = $3' : 'AND area_id IS NULL';
        const params = areaId ? [locationId, bin.name, areaId] : [locationId, bin.name];
        const existing = querySync(
          `SELECT id FROM bins WHERE location_id = $1 AND name = $2 ${areaClause} AND deleted_at IS NULL`,
          params,
        );
        if (existing.rows.length > 0) {
          toSkip.push({ name: bin.name, reason: 'already exists' });
          continue;
        }
      }

      toCreate.push({ name: bin.name, itemCount: bin.items.length, tags: bin.tags });
    }

    res.json({ preview: true, toCreate, toSkip, totalBins: pendingBins.length, totalItems });
    return;
  }

  const now = new Date().toISOString();

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

    let binsImported = 0;
    let binsSkipped = 0;
    let itemsImported = 0;

    for (const bin of pendingBins) {
      const areaId = resolveAreaSync(locationId, bin.area, userId);

      if (importMode === 'merge') {
        const areaClause = areaId
          ? 'AND area_id = $3'
          : 'AND area_id IS NULL';
        const params = areaId
          ? [locationId, bin.name, areaId]
          : [locationId, bin.name];
        const existing = querySync(
          `SELECT id FROM bins WHERE location_id = $1 AND name = $2 ${areaClause} AND deleted_at IS NULL`,
          params
        );
        if (existing.rows.length > 0) {
          binsSkipped++;
          continue;
        }
      }

      const binId = insertBinWithShortCode('', locationId, {
        name: bin.name,
        notes: '',
        tags: bin.tags,
        icon: '',
        color: '',
        createdAt: now,
        updatedAt: now,
      }, areaId, userId);

      insertBinItemsSync(binId, bin.items.map(i => ({ name: i.name, quantity: i.quantity })));
      itemsImported += bin.items.length;
      binsImported++;
    }

    return { binsImported, binsSkipped, itemsImported };
  });

  const result = doImport();
  res.json(result);
}));

// POST /api/locations/:id/import/zip — import from ZIP backup
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
}).single('file');

router.post('/locations/:id/import/zip', zipUpload, requireLocationMember(), asyncHandler(async (req, res) => {
  const locationId = req.params.id;
  const userId = req.user!.id;

  await requireMemberOrAbove(locationId, userId, 'import ZIP');

  if (!req.file) {
    throw new ValidationError('ZIP file is required');
  }

  const zip = new AdmZip(req.file.buffer);

  // Read and validate manifest
  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) {
    throw new ValidationError('ZIP does not contain manifest.json');
  }
  let manifest: {
    format?: string;
    locationSettings?: ExportLocationSettings;
    areas?: ExportArea[];
    tagColors?: Array<{ tag: string; color: string }>;
    customFieldDefinitions?: Array<{ name: string; position: number }>;
    pinnedBins?: ExportPinnedBin[];
    savedViews?: ExportSavedView[];
    members?: ExportMember[];
  };
  try {
    manifest = JSON.parse(manifestEntry.getData().toString('utf-8'));
  } catch {
    throw new ValidationError('manifest.json is not valid JSON');
  }
  if (manifest.format !== 'openbin-zip') {
    throw new ValidationError('Invalid ZIP format: manifest.format must be "openbin-zip"');
  }

  // Read and validate bins
  const binsEntry = zip.getEntry('bins.json');
  if (!binsEntry) {
    throw new ValidationError('ZIP does not contain bins.json');
  }
  let zipBins: Array<{
    id?: string;
    name: string;
    location?: string;
    items?: Array<string | { name: string; quantity?: number | null }>;
    notes?: string;
    tags?: string[];
    icon?: string;
    color?: string;
    cardStyle?: string;
    visibility?: 'location' | 'private';
    customFields?: Record<string, string>;
    shortCode?: string;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
    photos?: Array<{ id: string; filename: string; mimeType: string; zipPath: string; createdBy?: string; createdAt?: string }>;
  }>;
  try {
    zipBins = JSON.parse(binsEntry.getData().toString('utf-8'));
  } catch {
    throw new ValidationError('bins.json is not valid JSON');
  }
  if (!Array.isArray(zipBins)) {
    throw new ValidationError('bins.json must be an array');
  }

  // Read trashed bins if present
  const trashedBinsEntry = zip.getEntry('trashed-bins.json');
  let zipTrashedBins: typeof zipBins = [];
  if (trashedBinsEntry) {
    try {
      const parsed = JSON.parse(trashedBinsEntry.getData().toString('utf-8'));
      if (Array.isArray(parsed)) zipTrashedBins = parsed;
    } catch { /* ignore malformed trashed-bins.json */ }
  }

  if (zipBins.length + zipTrashedBins.length > 2000) {
    throw new ValidationError('Too many bins in import (max 2000)');
  }

  const importMode = (req.body?.mode === 'replace' ? 'replace' : 'merge') as 'merge' | 'replace';
  const dryRun = req.body?.dryRun === 'true' || req.body?.dryRun === true;

  if (dryRun) {
    const dryRunBins: DryRunBin[] = zipBins.map(b => ({
      id: b.id,
      name: b.name,
      items: b.items,
      tags: b.tags,
    }));
    res.json(buildDryRunPreview(dryRunBins, importMode));
    return;
  }

  // Convert ZIP photo references to base64 ExportBin[]
  function convertZipBins(source: typeof zipBins, opts?: { trashed?: boolean }): ExportBin[] {
    return source.map((bin) => {
      const photos: ExportPhoto[] = [];
      if (bin.photos && Array.isArray(bin.photos)) {
        for (const ref of bin.photos) {
          const photoEntry = zip.getEntry(ref.zipPath);
          if (!photoEntry) continue;
          photos.push({ id: ref.id, filename: ref.filename, mimeType: ref.mimeType, data: photoEntry.getData().toString('base64'), createdBy: ref.createdBy, createdAt: ref.createdAt });
        }
      }
      return {
        id: bin.id || uuidv4(),
        name: bin.name,
        location: bin.location || '',
        items: bin.items || [],
        notes: bin.notes || '',
        tags: bin.tags || [],
        icon: bin.icon || '',
        color: bin.color || '',
        cardStyle: bin.cardStyle,
        visibility: bin.visibility,
        customFields: bin.customFields,
        shortCode: bin.shortCode,
        createdBy: bin.createdBy,
        deletedAt: opts?.trashed ? ((bin as Record<string, unknown>).deletedAt as string) : undefined,
        createdAt: bin.createdAt || new Date().toISOString(),
        updatedAt: bin.updatedAt || new Date().toISOString(),
        photos,
      };
    });
  }

  const exportBins = convertZipBins(zipBins);
  const exportTrashedBins = convertZipBins(zipTrashedBins, { trashed: true });

  // Check if importing user is admin
  const memberRow = querySync<{ role: string }>(
    'SELECT role FROM location_members WHERE location_id = $1 AND user_id = $2',
    [locationId, userId]
  );
  const isAdmin = memberRow.rows.length > 0 && memberRow.rows[0].role === 'admin';

  const doImport = getDb().transaction(() => {
    // 1. Replace-mode cleanup
    if (importMode === 'replace') {
      const existingPhotos = querySync<{ storage_path: string }>(
        'SELECT storage_path FROM photos WHERE bin_id IN (SELECT id FROM bins WHERE location_id = $1)',
        [locationId]
      );
      querySync('DELETE FROM bins WHERE location_id = $1', [locationId]);
      querySync('DELETE FROM areas WHERE location_id = $1', [locationId]);
      for (const photo of existingPhotos.rows) {
        try {
          const filePath = safePath(PHOTO_STORAGE_PATH, photo.storage_path);
          if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch { /* ignore */ }
      }
    }

    // 2. Location settings (replace mode only, admin only)
    let settingsApplied = false;
    if (manifest.locationSettings && importMode === 'replace' && isAdmin) {
      importLocationSettingsSync(locationId, manifest.locationSettings);
      settingsApplied = true;
    }

    // 3. Members (admin only)
    let membersImported = 0;
    if (manifest.members && Array.isArray(manifest.members) && isAdmin) {
      membersImported = importMembersSync(locationId, manifest.members);
    }

    // 4. Tag colors
    if (manifest.tagColors && Array.isArray(manifest.tagColors)) {
      importTagColorsSync(locationId, manifest.tagColors);
    }

    // 5. Custom field definitions
    let fieldNameToId: Map<string, string> | undefined;
    if (manifest.customFieldDefinitions && Array.isArray(manifest.customFieldDefinitions)) {
      fieldNameToId = resolveCustomFieldDefsSync(locationId, manifest.customFieldDefinitions);
    }

    // 6. Areas
    let areasImported = 0;
    if (manifest.areas && Array.isArray(manifest.areas)) {
      areasImported = importAreasSync(locationId, manifest.areas, userId);
    }

    // Helper to import a single bin
    const oldToNewBinId = new Map<string, string>();

    function importSingleBin(bin: ExportBin, opts?: { deletedAt?: string | null }): boolean {
      if (importMode === 'merge') {
        const existing = querySync('SELECT id FROM bins WHERE id = $1', [bin.id]);
        if (existing.rows.length > 0) return false;
      }
      const areaId = resolveAreaSync(locationId, bin.location || '', userId);
      let resolvedCustomFields = bin.customFields;
      if (resolvedCustomFields && fieldNameToId && fieldNameToId.size > 0) {
        resolvedCustomFields = mapCustomFieldsToIds(resolvedCustomFields, fieldNameToId);
      }
      const resolvedCreatedBy = resolveCreatedBySync(bin.createdBy, userId);
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
        deletedAt: opts?.deletedAt,
        createdAt: bin.createdAt || new Date().toISOString(),
        updatedAt: bin.updatedAt || new Date().toISOString(),
      }, areaId, resolvedCreatedBy);
      oldToNewBinId.set(bin.id, binId);
      insertBinItemsSync(binId, bin.items || []);
      return true;
    }

    // 7. Active bins
    let binsImported = 0;
    let binsSkipped = 0;
    let photosImported = 0;

    for (const bin of exportBins) {
      if (importSingleBin(bin)) {
        const newBinId = oldToNewBinId.get(bin.id)!;
        if (bin.photos && Array.isArray(bin.photos)) {
          photosImported += importPhotosSync(newBinId, bin.photos, userId);
        }
        binsImported++;
      } else {
        binsSkipped++;
      }
    }

    // 8. Trashed bins
    let trashedBinsImported = 0;
    for (const bin of exportTrashedBins) {
      if (importSingleBin(bin, { deletedAt: bin.deletedAt })) {
        const newBinId = oldToNewBinId.get(bin.id)!;
        if (bin.photos && Array.isArray(bin.photos)) {
          photosImported += importPhotosSync(newBinId, bin.photos, userId);
        }
        trashedBinsImported++;
      }
    }

    // 9. Pinned bins
    let pinsImported = 0;
    if (manifest.pinnedBins && Array.isArray(manifest.pinnedBins)) {
      pinsImported = importPinnedBinsSync(manifest.pinnedBins, oldToNewBinId);
    }

    // 10. Saved views
    let viewsImported = 0;
    if (manifest.savedViews && Array.isArray(manifest.savedViews)) {
      viewsImported = importSavedViewsSync(manifest.savedViews);
    }

    return { binsImported, binsSkipped, trashedBinsImported, photosImported, areasImported, pinsImported, viewsImported, membersImported, settingsApplied };
  });

  const result = doImport();

  res.json({
    binsImported: result.binsImported,
    binsSkipped: result.binsSkipped,
    trashedBinsImported: result.trashedBinsImported,
    photosImported: result.photosImported,
    photosSkipped: 0,
    areasImported: result.areasImported,
    pinsImported: result.pinsImported,
    viewsImported: result.viewsImported,
    membersImported: result.membersImported,
    settingsApplied: result.settingsApplied,
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
