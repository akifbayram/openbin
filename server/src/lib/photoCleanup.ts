import fs from 'node:fs';
import path from 'node:path';
import { querySync } from '../db.js';
import { config } from './config.js';
import { safePath } from './pathSafety.js';
import { storage } from './storage.js';
import { PHOTO_STORAGE_PATH } from './uploadConfig.js';

export async function cleanupBinPhotos(
  binId: string,
  photos: { storage_path: string; thumb_path: string | null }[],
): Promise<void> {
  for (const photo of photos) {
    try {
      await storage.delete(photo.storage_path);
      if (photo.thumb_path) {
        await storage.delete(photo.thumb_path);
      }
    } catch {
      // Ignore file cleanup errors
    }
  }

  // Remove empty bin directory (local storage only)
  if (config.storageBackend !== 's3') {
    try {
      const binDir = safePath(PHOTO_STORAGE_PATH, binId);
      if (binDir && fs.existsSync(binDir)) {
        fs.rmdirSync(binDir);
      }
    } catch {
      // Ignore directory cleanup errors
    }
  }
}

/** Scan PHOTO_STORAGE_PATH and delete files with no matching photos row. Local storage only. */
export function cleanupOrphanPhotos(): void {
  if (config.storageBackend === 's3') return;
  if (!fs.existsSync(PHOTO_STORAGE_PATH)) return;

  // Collect all known paths from DB
  const result = querySync<{ storage_path: string; thumb_path: string | null }>(
    'SELECT storage_path, thumb_path FROM photos',
  );
  const knownPaths = new Set<string>();
  for (const row of result.rows) {
    knownPaths.add(row.storage_path);
    if (row.thumb_path) knownPaths.add(row.thumb_path);
  }

  let deletedCount = 0;

  try {
    const entries = fs.readdirSync(PHOTO_STORAGE_PATH, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subdir = entry.name;
      const subdirPath = safePath(PHOTO_STORAGE_PATH, subdir);
      if (!subdirPath) continue;

      const files = fs.readdirSync(subdirPath);
      for (const file of files) {
        const relativePath = path.join(subdir, file);
        if (knownPaths.has(relativePath)) continue;

        const filePath = safePath(PHOTO_STORAGE_PATH, relativePath);
        if (!filePath) continue;

        try {
          fs.unlinkSync(filePath);
          console.log(`[photo-cleanup] Deleted orphan file: ${relativePath}`);
          deletedCount++;
        } catch {
          // Ignore individual file deletion errors
        }
      }

      // Remove empty directories
      try {
        fs.rmdirSync(subdirPath);
      } catch {
        // Directory not empty or other error — ignore
      }
    }
  } catch (err) {
    console.error('[photo-cleanup] Error scanning uploads directory:', err);
  }

  if (deletedCount > 0) {
    console.log(`[photo-cleanup] Removed ${deletedCount} orphan file(s)`);
  }
}
