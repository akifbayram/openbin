import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import express, { Router } from 'express';
import { unzipSync } from 'fflate';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireMemberOrAbove } from '../lib/binAccess.js';
import { config } from '../lib/config.js';
import { parseCSV } from '../lib/csvParser.js';
import {
  buildAreaPathMap,
  buildExportBinEntry,
  buildFieldIdToNameMap,
  type ExportArea,
  type ExportBin,
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
  importPhotos,
  insertBinItems,
  insertBinWithShortCode,
  isLocationAdminCheck,
  loadBinPhotoMeta,
  loadBinPhotosBase64,
  resolveArea,
} from '../lib/exportHelpers.js';
import { NotFoundError, ValidationError } from '../lib/httpErrors.js';
import {
  buildDryRunPreview,
  type DryRunBin,
  executeFullImportTransaction,
  lookupArea,
} from '../lib/importTransaction.js';
import { safePath } from '../lib/pathSafety.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';
import { requirePro } from '../middleware/requirePlan.js';

const router = Router();
const PHOTO_STORAGE_PATH = config.photoStoragePath;

/** Export size limits to prevent DoS via unbounded base64 photo streaming */
const MAX_EXPORT_BINS = 5000;
const MAX_EXPORT_PHOTOS_PER_BIN = 50;
const MAX_EXPORT_TOTAL_PHOTOS = 1000;

/**
 * Parse a tags field from CSV.
 * New exports use "; " (semicolon-space) as the delimiter to avoid splitting
 * tags that contain commas (e.g. "nuts, bolts"). Legacy exports used bare
 * commas, so we fall back to comma-splitting when no semicolons are present.
 */
function parseCsvTags(raw: string): string[] {
  if (raw.includes(';')) {
    return raw.split(';').map(t => t.trim()).filter(Boolean);
  }
  return raw.split(',').map(t => t.trim()).filter(Boolean);
}

router.use(authenticate);

// GET /api/locations/:id/export — export all bins + photos for a location
// Streams JSON to avoid OOM: only one bin's photos are in memory at a time.
router.get('/locations/:id/export', requireLocationMember(), requirePro(), asyncHandler(async (req, res) => {
  const locationId = req.params.id;
  await requireMemberOrAbove(locationId, req.user!.id, 'export location data');

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

  if (bins.length + trashedBinsRaw.length > MAX_EXPORT_BINS) {
    throw new ValidationError(`Export limited to ${MAX_EXPORT_BINS} bins. Use filters or export in batches.`);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="openbin-export-${locationId}.json"`);

  // Write opening fields
  res.write(`{"version":2,"exportedAt":${JSON.stringify(new Date().toISOString())},"locationName":${JSON.stringify(locationName)}`);
  if (locationSettings) {
    res.write(`,"locationSettings":${JSON.stringify(locationSettings)}`);
  }

  // Track total photos across all bins to enforce global cap
  let totalPhotosStreamed = 0;

  // Stream bins array one entry at a time so only one bin's photos are buffered
  async function streamBins(key: string, rows: typeof bins, opts?: { includeTrashed: boolean }) {
    res.write(`,"${key}":[`);
    for (let i = 0; i < rows.length; i++) {
      if (i > 0) res.write(',');
      const entry = buildExportBinEntry(rows[i], fieldIdToName, areaPathMap, opts);
      if (totalPhotosStreamed < MAX_EXPORT_TOTAL_PHOTOS) {
        let photos = await loadBinPhotosBase64(rows[i].id);
        if (photos.length > MAX_EXPORT_PHOTOS_PER_BIN) {
          photos = photos.slice(0, MAX_EXPORT_PHOTOS_PER_BIN);
        }
        const remaining = MAX_EXPORT_TOTAL_PHOTOS - totalPhotosStreamed;
        if (photos.length > remaining) {
          photos = photos.slice(0, remaining);
        }
        totalPhotosStreamed += photos.length;
        entry.photos = photos;
      } else {
        entry.photos = [];
      }
      res.write(JSON.stringify(entry));
    }
    res.write(']');
  }

  await streamBins('bins', bins);
  if (trashedBinsRaw.length > 0) {
    await streamBins('trashedBins', trashedBinsRaw, { includeTrashed: true });
  }

  // Remaining fields are small metadata — safe to buffer
  const allAreaPaths: ExportArea[] = Array.from(areaPathMap.values()).map(a => ({ path: a.path, createdBy: a.createdBy || undefined }));
  if (allAreaPaths.length > 0) res.write(`,"areas":${JSON.stringify(allAreaPaths)}`);
  if (tagColors.length > 0) res.write(`,"tagColors":${JSON.stringify(tagColors)}`);
  if (fieldDefs.length > 0) res.write(`,"customFieldDefinitions":${JSON.stringify(fieldDefs)}`);
  if (pinnedBins.length > 0) res.write(`,"pinnedBins":${JSON.stringify(pinnedBins)}`);
  if (savedViews.length > 0) res.write(`,"savedViews":${JSON.stringify(savedViews)}`);
  if (members.length > 0) res.write(`,"members":${JSON.stringify(members)}`);

  res.end('}');
}));

// GET /api/locations/:id/export/zip — export as ZIP with structured directories
router.get('/locations/:id/export/zip', requireLocationMember(), requirePro(), asyncHandler(async (req, res) => {
  const locationId = req.params.id;
  await requireMemberOrAbove(locationId, req.user!.id, 'export location data');

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

  if (dbBins.length + trashedBinsRaw.length > MAX_EXPORT_BINS) {
    throw new ValidationError(`Export limited to ${MAX_EXPORT_BINS} bins. Use filters or export in batches.`);
  }

  interface ZipPhotoRef { id: string; filename: string; mimeType: string; zipPath: string; createdBy?: string; createdAt?: string }
  type ZipBinEntry = Omit<ExportBin, 'photos'> & { photos: ZipPhotoRef[] };

  const bins: ZipBinEntry[] = [];
  const photosToInclude: Array<{ binId: string; photoId: string; filename: string; storagePath: string }> = [];
  let totalPhotosCollected = 0;

  async function collectPhotos(binId: string, entry: ZipBinEntry) {
    if (totalPhotosCollected >= MAX_EXPORT_TOTAL_PHOTOS) return;
    let photoMeta = await loadBinPhotoMeta(binId);
    if (photoMeta.length > MAX_EXPORT_PHOTOS_PER_BIN) {
      photoMeta = photoMeta.slice(0, MAX_EXPORT_PHOTOS_PER_BIN);
    }
    const remaining = MAX_EXPORT_TOTAL_PHOTOS - totalPhotosCollected;
    if (photoMeta.length > remaining) {
      photoMeta = photoMeta.slice(0, remaining);
    }
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
      totalPhotosCollected++;
    }
  }

  for (const bin of dbBins) {
    const entry: ZipBinEntry = { ...buildExportBinEntry(bin, fieldIdToName, areaPathMap), photos: [] };
    await collectPhotos(bin.id, entry);
    bins.push(entry);
  }

  const trashedBinEntries: ZipBinEntry[] = [];
  for (const bin of trashedBinsRaw) {
    const entry: ZipBinEntry = { ...buildExportBinEntry(bin, fieldIdToName, areaPathMap, { includeTrashed: true }), photos: [] };
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
  await requireMemberOrAbove(locationId, req.user!.id, 'export location data');

  const locationResult = await query('SELECT name FROM locations WHERE id = $1', [locationId]);
  if (locationResult.rows.length === 0) {
    throw new NotFoundError('Location not found');
  }

  const [bins, areaPathMap] = await Promise.all([
    fetchLocationBins(locationId),
    buildAreaPathMap(locationId),
  ]);

  function csvEscape(val: string): string {
    // Prevent CSV formula injection (Excel/Sheets interpret =, +, -, @, \t, \r as formulas)
    if (/^[=+\-@\t\r]/.test(val)) {
      val = "'" + val;
    }
    if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r') || val.includes("'")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  const header = 'Bin Name,Area,Item,Quantity,Tags';
  const rows: string[] = [];

  for (const bin of bins) {
    const items = extractItemsWithQuantity(bin.items);
    const tags = Array.isArray(bin.tags) ? bin.tags.join('; ') : '';
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
    res.json(await buildDryRunPreview(bins, importMode, locationId));
    return;
  }

  const result = await executeFullImportTransaction({
    locationId,
    userId,
    isAdmin: await isLocationAdminCheck(locationId, userId),
    importMode,
    bins,
    trashedBins,
    tagColors,
    customFieldDefinitions,
    locationSettings,
    areas,
    pinnedBins,
    savedViews,
    members,
  });

  res.json(result);
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
          ? parseCsvTags(tagsRaw)
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
        ? parseCsvTags(tagsRaw)
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
          areaId = await lookupArea(locationId, bin.area);
          areaCache.set(bin.area, areaId);
        }

        const areaClause = areaId ? 'AND area_id = $3' : 'AND area_id IS NULL';
        const params = areaId ? [locationId, bin.name, areaId] : [locationId, bin.name];
        const existing = await query(
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

  const result = await withTransaction(async (tx) => {
    if (importMode === 'replace') {
      const existingPhotos = await tx<{ storage_path: string }>(
        'SELECT storage_path FROM photos WHERE bin_id IN (SELECT id FROM bins WHERE location_id = $1)',
        [locationId]
      );
      await tx('DELETE FROM bins WHERE location_id = $1', [locationId]);
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
      const areaId = await resolveArea(locationId, bin.area, userId, tx);

      if (importMode === 'merge') {
        const areaClause = areaId
          ? 'AND area_id = $3'
          : 'AND area_id IS NULL';
        const params = areaId
          ? [locationId, bin.name, areaId]
          : [locationId, bin.name];
        const existing = await tx(
          `SELECT id FROM bins WHERE location_id = $1 AND name = $2 ${areaClause} AND deleted_at IS NULL`,
          params
        );
        if (existing.rows.length > 0) {
          binsSkipped++;
          continue;
        }
      }

      const binId = await insertBinWithShortCode(locationId, {
        name: bin.name,
        notes: '',
        tags: bin.tags,
        icon: '',
        color: '',
        createdAt: now,
        updatedAt: now,
      }, areaId, userId, tx);

      await insertBinItems(binId, bin.items.map(i => ({ name: i.name, quantity: i.quantity })), tx);
      itemsImported += bin.items.length;
      binsImported++;
    }

    return { binsImported, binsSkipped, itemsImported };
  });

  res.json(result);
}));

// POST /api/locations/:id/import/zip — import from ZIP backup
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
}).single('file');

router.post('/locations/:id/import/zip', zipUpload, requireLocationMember(), asyncHandler(async (req, res) => {
  const locationId = req.params.id;
  const userId = req.user!.id;

  await requireMemberOrAbove(locationId, userId, 'import ZIP');

  if (!req.file) {
    throw new ValidationError('ZIP file is required');
  }

  const files = unzipSync(req.file.buffer);

  // Best-effort ZIP bomb guard: fflate decompresses synchronously so the data is already
  // in memory by this point. The 25 MB upload limit caps worst-case memory at ~500 MB.
  let totalDecompressed = 0;
  for (const data of Object.values(files)) {
    totalDecompressed += (data as Uint8Array).length;
  }
  if (totalDecompressed > 500 * 1024 * 1024) {
    throw new ValidationError('ZIP content exceeds 500 MB decompressed limit');
  }

  // Read and validate manifest
  const manifestData = files['manifest.json'];
  if (!manifestData) {
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
  const decoder = new TextDecoder();
  try {
    manifest = JSON.parse(decoder.decode(manifestData));
  } catch {
    throw new ValidationError('manifest.json is not valid JSON');
  }
  if (manifest.format !== 'openbin-zip') {
    throw new ValidationError('Invalid ZIP format: manifest.format must be "openbin-zip"');
  }

  // Read bins + trashed bins
  const binsData = files['bins.json'];
  if (!binsData) {
    throw new ValidationError('ZIP does not contain bins.json');
  }
  const trashedBinsData = files['trashed-bins.json'];

  type ZipBinEntry = {
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
  };

  const binsText = decoder.decode(binsData);
  const trashedText = trashedBinsData ? decoder.decode(trashedBinsData) : null;

  let zipBins: ZipBinEntry[];
  try {
    zipBins = JSON.parse(binsText);
  } catch {
    throw new ValidationError('bins.json is not valid JSON');
  }
  if (!Array.isArray(zipBins)) {
    throw new ValidationError('bins.json must be an array');
  }

  let zipTrashedBins: ZipBinEntry[] = [];
  if (trashedText) {
    try {
      const parsed = JSON.parse(trashedText);
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
      shortCode: b.shortCode,
      name: b.name,
      items: b.items,
      tags: b.tags,
    }));
    res.json(await buildDryRunPreview(dryRunBins, importMode, locationId));
    return;
  }

  // Convert ZIP photo references to base64 ExportBin[]
  function convertZipBins(source: typeof zipBins, opts?: { trashed?: boolean }): ExportBin[] {
    return source.map((bin) => {
      const photos: ExportPhoto[] = [];
      if (bin.photos && Array.isArray(bin.photos)) {
        for (const ref of bin.photos) {
          const photoBytes = files[ref.zipPath];
          if (!photoBytes) continue;
          const data = Buffer.from(photoBytes).toString('base64');
          photos.push({ id: ref.id, filename: ref.filename, mimeType: ref.mimeType, data, createdBy: ref.createdBy, createdAt: ref.createdAt });
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

  const result = await executeFullImportTransaction({
    locationId,
    userId,
    isAdmin: await isLocationAdminCheck(locationId, userId),
    importMode,
    bins: exportBins,
    trashedBins: exportTrashedBins,
    tagColors: manifest.tagColors,
    customFieldDefinitions: manifest.customFieldDefinitions,
    locationSettings: manifest.locationSettings,
    areas: manifest.areas,
    pinnedBins: manifest.pinnedBins,
    savedViews: manifest.savedViews,
    members: manifest.members,
  });

  res.json(result);
}));

export default router;
