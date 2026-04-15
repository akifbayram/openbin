import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { safePath } from './pathSafety.js';
import { storage } from './storage.js';

const ATTACHMENT_SUBDIR = 'attachments';

export function attachmentStoragePath(binId: string, filename: string): string {
  return path.posix.join(ATTACHMENT_SUBDIR, binId, filename);
}

export async function cleanupBinAttachments(
  binId: string,
  attachments: { storage_path: string }[],
): Promise<void> {
  await Promise.all(
    attachments.map((a) => storage.delete(a.storage_path).catch(() => {})),
  );

  if (config.storageBackend !== 's3') {
    const binDir = safePath(config.photoStoragePath, path.posix.join(ATTACHMENT_SUBDIR, binId));
    if (binDir) {
      await fs.rm(binDir, { recursive: false, force: true }).catch(() => {});
    }
  }
}
