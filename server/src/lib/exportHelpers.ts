import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { generateUuid, query, querySync } from '../db.js';
import { config } from './config.js';
import { replaceCustomFieldValuesSync } from './customFieldHelpers.js';
import { isPathSafe, safePath } from './pathSafety.js';
import { generateShortCode } from './shortCode.js';

const PHOTO_STORAGE_PATH = config.photoStoragePath;

const ALLOWED_PHOTO_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ExportBin {
  id: string;
  name: string;
  location: string;
  items: Array<string | { name: string; quantity?: number | null }>;
  notes: string;
  tags: string[];
  icon: string;
  color: string;
  cardStyle?: string;
  visibility?: 'location' | 'private';
  customFields?: Record<string, string>;
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

export interface ExportTagColor {
  tag: string;
  color: string;
}

export interface ExportCustomFieldDef {
  name: string;
  position: number;
}

export interface ExportData {
  version: 2;
  exportedAt: string;
  locationName: string;
  bins: ExportBin[];
  tagColors?: ExportTagColor[];
  customFieldDefinitions?: ExportCustomFieldDef[];
}

/**
 * Fetch all non-deleted bins for a location, joined with area names.
 * Returns raw DB rows with area_name column.
 */
export async function fetchLocationBins(locationId: string) {
  const result = await query(
    `SELECT b.id, b.name, COALESCE(a.name, '') AS area_name,
       COALESCE((SELECT json_group_array(json_object('id', bi.id, 'name', bi.name, 'quantity', bi.quantity))
         FROM (SELECT id, name, quantity FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items,
       b.notes, b.tags, b.icon, b.color, b.card_style, b.visibility,
       COALESCE((SELECT json_group_object(bcfv.field_id, bcfv.value) FROM bin_custom_field_values bcfv WHERE bcfv.bin_id = b.id), '{}') AS custom_fields,
       b.created_at, b.updated_at
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

/** Extract items with optional quantity from the items column. */
export function extractItemsWithQuantity(items: unknown): Array<string | { name: string; quantity: number }> {
  if (!Array.isArray(items)) return [];
  return items.map((i: string | { name: string; quantity?: number | null }) => {
    if (typeof i === 'string') return i;
    if (i.quantity != null && i.quantity >= 1) return { name: i.name, quantity: i.quantity };
    return i.name;
  });
}

/** Load photos for a bin and convert to base64. */
export async function loadBinPhotosBase64(binId: string): Promise<ExportPhoto[]> {
  const photosResult = await query(
    'SELECT id, filename, mime_type, storage_path FROM photos WHERE bin_id = $1',
    [binId]
  );

  const exportPhotos: ExportPhoto[] = [];
  for (const photo of photosResult.rows) {
    const filePath = safePath(PHOTO_STORAGE_PATH, photo.storage_path);
    if (!filePath) continue;
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
 * Insert a bin with short code as ID, with collision retry. Synchronous (for use in transactions).
 * Returns the generated bin ID.
 */
export function insertBinWithShortCode(
  _binId: string,
  locationId: string,
  bin: { name: string; notes: string; tags: string[]; icon: string; color: string; cardStyle?: string; visibility?: 'location' | 'private'; customFields?: Record<string, string>; shortCode?: string; createdAt: string; updatedAt: string },
  areaId: string | null,
  userId: string,
): string {
  const validCode = bin.shortCode && /^[A-Z0-9]{6}$/.test(bin.shortCode) ? bin.shortCode : undefined;
  for (let attempt = 0; attempt <= 10; attempt++) {
    const id = attempt === 0 && validCode ? validCode : generateShortCode(bin.name);
    try {
      querySync(
        `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, card_style, visibility, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, locationId, bin.name, areaId, bin.notes, bin.tags, bin.icon, bin.color, bin.cardStyle || '', bin.visibility || 'location', userId, bin.createdAt, bin.updatedAt]
      );
      if (bin.customFields && Object.keys(bin.customFields).length > 0) {
        replaceCustomFieldValuesSync(id, bin.customFields, locationId);
      }
      return id;
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
export function insertBinItemsSync(binId: string, items: Array<string | { name: string; quantity?: number | null }>): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = typeof item === 'string' ? item : item.name;
    const qty = typeof item === 'object' && item.quantity != null ? item.quantity : null;
    querySync(
      'INSERT INTO bin_items (id, bin_id, name, quantity, position) VALUES ($1, $2, $3, $4, $5)',
      [generateUuid(), binId, name, qty, i]
    );
  }
}

/** Fetch tag colors for a location. */
export async function fetchLocationTagColors(locationId: string): Promise<ExportTagColor[]> {
  const result = await query<{ tag: string; color: string }>(
    'SELECT tag, color FROM tag_colors WHERE location_id = $1',
    [locationId]
  );
  return result.rows;
}

/** Fetch custom field definitions for a location. */
export async function fetchLocationFieldDefs(locationId: string): Promise<ExportCustomFieldDef[]> {
  const result = await query<{ name: string; position: number }>(
    'SELECT name, position FROM location_custom_fields WHERE location_id = $1 ORDER BY position',
    [locationId]
  );
  return result.rows;
}

/** Build a fieldId → fieldName map for a location. */
export async function buildFieldIdToNameMap(locationId: string): Promise<Map<string, string>> {
  const result = await query<{ id: string; name: string }>(
    'SELECT id, name FROM location_custom_fields WHERE location_id = $1',
    [locationId]
  );
  const map = new Map<string, string>();
  for (const row of result.rows) {
    map.set(row.id, row.name);
  }
  return map;
}

/** Convert custom field values from fieldId-keyed to fieldName-keyed. */
export function mapCustomFieldsToNames(
  fields: Record<string, string>,
  idToName: Map<string, string>,
): Record<string, string> | undefined {
  const mapped: Record<string, string> = {};
  let hasValues = false;
  for (const [id, value] of Object.entries(fields)) {
    if (!value) continue;
    const name = idToName.get(id);
    if (name) {
      mapped[name] = value;
      hasValues = true;
    }
  }
  return hasValues ? mapped : undefined;
}

/** Import tag colors for a location. Synchronous (for transactions). */
export function importTagColorsSync(locationId: string, tagColors: ExportTagColor[]): void {
  for (const tc of tagColors) {
    if (!tc.tag || !tc.color) continue;
    querySync(
      `INSERT INTO tag_colors (id, location_id, tag, color) VALUES ($1, $2, $3, $4)
       ON CONFLICT(location_id, tag) DO UPDATE SET color = excluded.color, updated_at = datetime('now')`,
      [generateUuid(), locationId, tc.tag, tc.color]
    );
  }
}

/** Ensure custom field definitions exist, returning a name → fieldId map. Synchronous (for transactions). */
export function resolveCustomFieldDefsSync(
  locationId: string,
  defs: ExportCustomFieldDef[],
): Map<string, string> {
  const nameToId = new Map<string, string>();
  for (const def of defs) {
    if (!def.name) continue;
    const existing = querySync<{ id: string }>(
      'SELECT id FROM location_custom_fields WHERE location_id = $1 AND name = $2',
      [locationId, def.name]
    );
    if (existing.rows.length > 0) {
      nameToId.set(def.name, existing.rows[0].id);
    } else {
      const id = generateUuid();
      querySync(
        'INSERT INTO location_custom_fields (id, location_id, name, position) VALUES ($1, $2, $3, $4)',
        [id, locationId, def.name, def.position]
      );
      nameToId.set(def.name, id);
    }
  }
  return nameToId;
}

/** Convert name-keyed custom fields to fieldId-keyed using a name→id map. */
export function mapCustomFieldsToIds(
  fields: Record<string, string>,
  nameToId: Map<string, string>,
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (!value) continue;
    const id = nameToId.get(name);
    if (id) {
      mapped[id] = value;
    }
  }
  return mapped;
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

    const fullPath = path.join(PHOTO_STORAGE_PATH, storagePath);
    if (!isPathSafe(fullPath, PHOTO_STORAGE_PATH)) continue;

    const dir = safePath(PHOTO_STORAGE_PATH, binId);
    if (!dir) continue;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, buffer);

    const safeOriginalName = path.basename(photo.filename || 'photo').slice(0, 255);
    const safeMimeType = ALLOWED_MIME_TYPES.includes(photo.mimeType) ? photo.mimeType : 'image/jpeg';

    querySync(
      `INSERT INTO photos (id, bin_id, filename, mime_type, size, storage_path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [photoId, binId, safeOriginalName, safeMimeType, buffer.length, storagePath, userId]
    );
    count++;
  }
  return count;
}
