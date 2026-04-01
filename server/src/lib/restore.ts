import fs from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { reinitialize } from '../db.js';
import { config } from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('restore');

let restoreInProgress = false;

export function isRestoreInProgress(): boolean {
  return restoreInProgress;
}

export interface RestoreResult {
  success: boolean;
  error?: string;
}

export async function restoreBackup(zipPath: string): Promise<RestoreResult> {
  const dbPath = config.databasePath;
  const photoDir = config.photoStoragePath;
  const safetyDir = path.join(path.dirname(dbPath), '.pre-restore-backup');

  try {
    // Read and decompress ZIP
    const zipBuffer = fs.readFileSync(zipPath);
    const files = unzipSync(new Uint8Array(zipBuffer));

    // Validate: must contain openbin.db
    const dbEntry = files['openbin.db'];
    if (!dbEntry) {
      return { success: false, error: 'ZIP does not contain openbin.db' };
    }

    // Block new requests
    restoreInProgress = true;

    // Create safety backup
    fs.mkdirSync(safetyDir, { recursive: true });
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, path.join(safetyDir, 'openbin.db'));
    }
    // Also back up WAL/SHM if they exist
    for (const suffix of ['-wal', '-shm']) {
      const walPath = dbPath + suffix;
      if (fs.existsSync(walPath)) {
        fs.copyFileSync(walPath, path.join(safetyDir, `openbin.db${suffix}`));
      }
    }
    if (fs.existsSync(photoDir)) {
      const photoDest = path.join(safetyDir, 'photos');
      try {
        fs.renameSync(photoDir, photoDest);
      } catch {
        copyDirSync(photoDir, photoDest);
      }
    }

    // Replace DB file
    fs.writeFileSync(dbPath, dbEntry);
    // Remove stale WAL/SHM from previous DB
    for (const suffix of ['-wal', '-shm']) {
      const walPath = dbPath + suffix;
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
      }
    }

    // Extract photos if present
    const photoPrefix = 'photos/';
    for (const [name, data] of Object.entries(files)) {
      if (!name.startsWith(photoPrefix) || name === photoPrefix) continue;
      const relativePath = name.slice(photoPrefix.length);
      const destPath = path.join(photoDir, relativePath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, data);
    }

    // Re-initialize database connection
    await reinitialize();

    log.info('Backup restored successfully');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('Restore failed:', message);
    return { success: false, error: message };
  } finally {
    restoreInProgress = false;
  }
}

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
