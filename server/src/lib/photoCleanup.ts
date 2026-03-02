import fs from 'node:fs';
import { safePath } from './pathSafety.js';
import { PHOTO_STORAGE_PATH } from './uploadConfig.js';

export function cleanupBinPhotos(
  binId: string,
  photos: { storage_path: string; thumb_path: string | null }[],
): void {
  for (const photo of photos) {
    try {
      const filePath = safePath(PHOTO_STORAGE_PATH, photo.storage_path);
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (photo.thumb_path) {
        const thumbFilePath = safePath(PHOTO_STORAGE_PATH, photo.thumb_path);
        if (thumbFilePath && fs.existsSync(thumbFilePath)) {
          fs.unlinkSync(thumbFilePath);
        }
      }
    } catch {
      // Ignore file cleanup errors
    }
  }

  try {
    const binDir = safePath(PHOTO_STORAGE_PATH, binId);
    if (binDir && fs.existsSync(binDir)) {
      fs.rmdirSync(binDir);
    }
  } catch {
    // Ignore directory cleanup errors
  }
}
