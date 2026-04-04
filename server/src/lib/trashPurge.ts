import fs from 'node:fs/promises';
import { d, query } from '../db.js';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { safePath } from './pathSafety.js';

const log = createLogger('trashPurge');

const PHOTO_STORAGE_PATH = config.photoStoragePath;

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
         AND b.deleted_at < ${d.intervalDaysAgo('l.trash_retention_days')}`,
      [locationId]
    );

    if (expired.rows.length === 0) return;

    const binIds = expired.rows.map((r) => r.id as string);
    const placeholders = binIds.map((_, i) => `$${i + 1}`).join(', ');

    // Batch query photos for disk cleanup
    const photos = await query<{ storage_path: string }>(
      `SELECT storage_path FROM photos WHERE bin_id IN (${placeholders})`,
      binIds
    );

    // Batch hard delete bins (CASCADE deletes photo rows)
    await query(
      `DELETE FROM bins WHERE id IN (${placeholders})`,
      binIds
    );

    // Clean up photo files from disk (parallel async I/O)
    await Promise.allSettled(
      photos.rows.map(async (photo) => {
        const filePath = safePath(PHOTO_STORAGE_PATH, photo.storage_path);
        if (filePath) {
          await fs.unlink(filePath);
        }
      })
    );

    // Clean up empty bin directories (parallel async I/O)
    await Promise.allSettled(
      binIds.map(async (binId) => {
        const binDir = safePath(PHOTO_STORAGE_PATH, binId);
        if (binDir) {
          await fs.rm(binDir, { recursive: true, force: true });
        }
      })
    );
  } catch (err) {
    log.error('Trash purge error:', err instanceof Error ? err.message : err);
  }
}
