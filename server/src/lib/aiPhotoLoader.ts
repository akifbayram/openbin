import fs from 'node:fs/promises';
import { query } from '../db.js';
import { fetchExistingTags } from './aiContext.js';
import type { CustomFieldDef } from './customFieldHelpers.js';
import { fetchCustomFieldDefs } from './customFieldHelpers.js';
import { safePath } from './pathSafety.js';
import { PHOTO_STORAGE_PATH } from './uploadConfig.js';

export interface LoadedPhotos {
  images: Array<{ buffer: Buffer; mimeType: string }>;
  locationId: string;
  existingTags: string[];
  customFieldDefs: CustomFieldDef[] | undefined;
}

/**
 * Load stored photos for AI analysis: validates access, reads files,
 * and fetches location tags + custom field definitions.
 * Returns null if photo files are missing on disk.
 */
export async function loadPhotosForAnalysis(ids: string[], userId: string): Promise<LoadedPhotos | null> {
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const photoResult = await query(
    `SELECT p.id, p.storage_path, p.mime_type, b.location_id FROM photos p
     JOIN bins b ON b.id = p.bin_id
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $${ids.length + 1}
     WHERE p.id IN (${placeholders})
       AND (b.visibility = 'location' OR b.created_by = $${ids.length + 1})`,
    [...ids, userId]
  );

  if (photoResult.rows.length !== ids.length) {
    return null;
  }

  const locationId: string = photoResult.rows[0].location_id;

  const [imageBuffers, existingTags, customFieldDefs] = await Promise.all([
    Promise.all(
      photoResult.rows.map(async (row) => {
        const filePath = safePath(PHOTO_STORAGE_PATH, row.storage_path);
        if (!filePath) {
          throw Object.assign(new Error('Invalid photo path'), { statusCode: 404 });
        }
        const buffer = await fs.readFile(filePath);
        return { buffer, mimeType: row.mime_type as string };
      })
    ).catch((err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT' || (err as { statusCode?: number }).statusCode === 404) {
        return null;
      }
      throw err;
    }),
    fetchExistingTags(locationId),
    fetchCustomFieldDefs(locationId),
  ]);

  if (!imageBuffers) {
    return null;
  }

  return { images: imageBuffers, locationId, existingTags, customFieldDefs };
}

/** Build a deterministic mock analysis result. */
export function buildMockAnalysisResult() {
  return {
    name: `Test Bin ${Date.now().toString(36).slice(-4).toUpperCase()}`,
    items: ['Screwdriver', 'Wrench set', 'Duct tape', 'Cable ties'],
    tags: ['tools', 'hardware'],
    notes: 'Mock AI analysis — generated without an API call.',
  };
}
