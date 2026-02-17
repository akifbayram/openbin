import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query, querySync, generateUuid } from '../db.js';
import { generateShortCode } from './shortCode.js';

const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads';

const ALLOWED_PHOTO_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

export interface ExportBin {
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

export interface ExportPhoto {
  id: string;
  filename: string;
  mimeType: string;
  data: string; // base64
}

export interface ExportData {
  version: 2;
  exportedAt: string;
  locationName: string;
  bins: ExportBin[];
}

/**
 * Fetch all non-deleted bins for a location, joined with area names.
 * Returns raw DB rows with area_name column.
 */
export async function fetchLocationBins(locationId: string) {
  const result = await query(
    `SELECT b.id, b.name, COALESCE(a.name, '') AS area_name,
       COALESCE((SELECT json_group_array(json_object('id', bi.id, 'name', bi.name))
         FROM (SELECT id, name FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items,
       b.notes, b.tags, b.icon, b.color, b.short_code, b.created_at, b.updated_at
     FROM bins b LEFT JOIN areas a ON a.id = b.area_id
     WHERE b.location_id = $1 AND b.deleted_at IS NULL
     ORDER BY b.updated_at DESC`,
    [locationId]
  );
  return result.rows;
}

/** Extract item names from the items column (handles both string[] and {name}[] formats). */
export function extractItemNames(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((i: string | { name: string }) => typeof i === 'string' ? i : i.name);
}

/** Load photos for a bin and convert to base64. */
export async function loadBinPhotosBase64(binId: string): Promise<ExportPhoto[]> {
  const photosResult = await query(
    'SELECT id, filename, mime_type, storage_path FROM photos WHERE bin_id = $1',
    [binId]
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
  return exportPhotos;
}

/** Load photo metadata for a bin (no file data). */
export async function loadBinPhotoMeta(binId: string) {
  const result = await query(
    'SELECT id, filename, mime_type, storage_path FROM photos WHERE bin_id = $1',
    [binId]
  );
  return result.rows;
}

/**
 * Resolve an area name string to an area ID within a location.
 * Creates the area if it does not exist. Synchronous (for use in transactions).
 */
export function resolveAreaSync(locationId: string, areaName: string, userId: string): string | null {
  const trimmed = areaName.trim();
  if (!trimmed) return null;

  const existing = querySync('SELECT id FROM areas WHERE location_id = $1 AND name = $2', [locationId, trimmed]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id as string;
  }

  const newId = generateUuid();
  querySync(
    'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
    [newId, locationId, trimmed, userId]
  );
  return newId;
}

/**
 * Insert a bin with short code collision retry. Synchronous (for use in transactions).
 * Returns true on success.
 */
export function insertBinWithShortCode(
  binId: string,
  locationId: string,
  bin: { name: string; notes: string; tags: string[]; icon: string; color: string; shortCode?: string; createdAt: string; updatedAt: string },
  areaId: string | null,
  userId: string,
): void {
  for (let attempt = 0; attempt <= 10; attempt++) {
    const code = attempt === 0 && bin.shortCode ? bin.shortCode : generateShortCode();
    try {
      querySync(
        `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, short_code, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [binId, locationId, bin.name, areaId, bin.notes, bin.tags, bin.icon, bin.color, code, userId, bin.createdAt, bin.updatedAt]
      );
      return;
    } catch (err: unknown) {
      const sqliteErr = err as { code?: string };
      if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE' && attempt < 10) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to generate unique short code');
}

/** Insert items into bin_items. Synchronous (for use in transactions). */
export function insertBinItemsSync(binId: string, items: string[]): void {
  for (let i = 0; i < items.length; i++) {
    querySync(
      'INSERT INTO bin_items (id, bin_id, name, position) VALUES ($1, $2, $3, $4)',
      [generateUuid(), binId, items[i], i]
    );
  }
}

/** Import photos from base64 data into storage. Synchronous (for use in transactions). */
export function importPhotosSync(binId: string, photos: ExportPhoto[], userId: string): number {
  let count = 0;
  for (const photo of photos) {
    const buffer = Buffer.from(photo.data, 'base64');
    if (buffer.length > 10 * 1024 * 1024) continue; // Skip oversized photos

    const photoId = uuidv4();
    const photoExt = path.extname(photo.filename || '').toLowerCase();
    const safeExt = ALLOWED_PHOTO_EXTS.includes(photoExt) ? photoExt : '.jpg';
    const safeFilename = `${photoId}${safeExt}`;
    const storagePath = path.join(binId, safeFilename);

    if (storagePath.includes('..')) continue;

    const dir = path.join(PHOTO_STORAGE_PATH, binId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(PHOTO_STORAGE_PATH, storagePath), buffer);

    querySync(
      `INSERT INTO photos (id, bin_id, filename, mime_type, size, storage_path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [photoId, binId, photo.filename, photo.mimeType, buffer.length, storagePath, userId]
    );
    count++;
  }
  return count;
}
