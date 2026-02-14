import fs from 'fs';
import path from 'path';
import { query } from '../db.js';

const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads';

/**
 * Purge soft-deleted bins that have exceeded their location's trash_retention_days.
 * Fire-and-forget — all errors are caught internally.
 */
export async function purgeExpiredTrash(locationId: string): Promise<void> {
  try {
    // Find expired bins
    const expired = await query(
      `SELECT b.id FROM bins b
       JOIN locations l ON l.id = b.location_id
       WHERE b.location_id = $1
         AND b.deleted_at IS NOT NULL
         AND b.deleted_at < datetime('now', '-' || l.trash_retention_days || ' days')`,
      [locationId]
    );

    if (expired.rows.length === 0) return;

    const binIds = expired.rows.map((r) => r.id as string);

    // Query photos for disk cleanup — use individual queries per bin
    const allPhotos: { storage_path: string }[] = [];
    for (const binId of binIds) {
      const photos = await query<{ storage_path: string }>(
        'SELECT storage_path FROM photos WHERE bin_id = $1',
        [binId]
      );
      allPhotos.push(...photos.rows);
    }

    // Hard delete bins (CASCADE deletes photo rows)
    for (const binId of binIds) {
      await query('DELETE FROM bins WHERE id = $1', [binId]);
    }

    // Clean up photo files from disk
    for (const photo of allPhotos) {
      try {
        const filePath = path.join(PHOTO_STORAGE_PATH, photo.storage_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore file cleanup errors
      }
    }

    // Clean up empty bin directories
    for (const binId of binIds) {
      try {
        const binDir = path.join(PHOTO_STORAGE_PATH, binId);
        if (fs.existsSync(binDir)) {
          fs.rmdirSync(binDir);
        }
      } catch {
        // Ignore directory cleanup errors
      }
    }
  } catch (err) {
    console.error('Trash purge error:', err);
  }
}
