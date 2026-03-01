import fs from 'node:fs';
import path from 'node:path';
import { PHOTO_STORAGE_PATH } from './uploadConfig.js';

export function cleanupBinPhotos(
  binId: string,
  photos: { storage_path: string; thumb_path: string | null }[],
): void {
  for (const photo of photos) {
    try {
      const filePath = path.join(PHOTO_STORAGE_PATH, photo.storage_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (photo.thumb_path) {
        const thumbFilePath = path.join(PHOTO_STORAGE_PATH, photo.thumb_path);
        if (fs.existsSync(thumbFilePath)) {
          fs.unlinkSync(thumbFilePath);
        }
      }
    } catch {
      // Ignore file cleanup errors
    }
  }

  try {
    const binDir = path.join(PHOTO_STORAGE_PATH, binId);
    if (fs.existsSync(binDir)) {
      fs.rmdirSync(binDir);
    }
  } catch {
    // Ignore directory cleanup errors
  }
}
