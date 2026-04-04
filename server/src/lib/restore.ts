import { execFile as execFileCb } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
import { closeDb, getDialect, reinitialize } from '../db.js';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { safePath } from './pathSafety.js';

const execFileAsync = promisify(execFileCb);

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
  const zipBuffer = fs.readFileSync(zipPath);
  const files = unzipSync(zipBuffer);

  const hasSqlite = !!files['openbin.db'];
  const hasPostgres = !!files['openbin.sql'];

  if (!hasSqlite && !hasPostgres) {
    return { success: false, error: 'ZIP does not contain openbin.db or openbin.sql' };
  }

  if (hasPostgres && getDialect() !== 'postgres') {
    return { success: false, error: 'Cannot restore a PostgreSQL backup into a SQLite database' };
  }
  if (hasSqlite && getDialect() !== 'sqlite') {
    return { success: false, error: 'Cannot restore a SQLite backup into a PostgreSQL database' };
  }

  if (getDialect() === 'postgres') {
    return restorePostgres(files);
  }
  return restoreSqlite(files);
}

// ── SQLite restore ──────────────────────────────────────────────────

async function restoreSqlite(files: Record<string, Uint8Array>): Promise<RestoreResult> {
  const dbPath = config.databasePath;
  const photoDir = config.photoStoragePath;
  const safetyDir = path.join(path.dirname(dbPath), '.pre-restore-backup');

  try {
    restoreInProgress = true;

    fs.mkdirSync(safetyDir, { recursive: true });
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, path.join(safetyDir, 'openbin.db'));
    }
    for (const suffix of ['-wal', '-shm']) {
      const walPath = dbPath + suffix;
      if (fs.existsSync(walPath)) {
        fs.copyFileSync(walPath, path.join(safetyDir, `openbin.db${suffix}`));
      }
    }
    backupPhotos(photoDir, safetyDir);

    await closeDb();

    fs.writeFileSync(dbPath, files['openbin.db']);
    for (const suffix of ['-wal', '-shm']) {
      const walPath = dbPath + suffix;
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
      }
    }

    restorePhotos(files, photoDir);
    await reinitialize();

    fs.rmSync(safetyDir, { recursive: true, force: true });
    log.info('Backup restored successfully');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('Restore failed:', message);
    try { await reinitialize(); } catch (reinitErr) {
      log.error('Failed to reinitialize DB after restore failure:', reinitErr instanceof Error ? reinitErr.message : reinitErr);
    }
    return { success: false, error: message };
  } finally {
    restoreInProgress = false;
  }
}

// ── PostgreSQL restore ──────────────────────────────────────────────

async function restorePostgres(files: Record<string, Uint8Array>): Promise<RestoreResult> {
  const connStr = config.databaseUrl;
  if (!connStr) {
    return { success: false, error: 'DATABASE_URL is required for PostgreSQL restore' };
  }

  const photoDir = config.photoStoragePath;
  const safetyDir = path.join(config.backupPath, '.pre-restore-backup');
  const safetyDump = path.join(safetyDir, 'pre-restore.sql');
  const restoreSql = path.join(safetyDir, 'openbin.sql');

  try {
    restoreInProgress = true;
    fs.mkdirSync(safetyDir, { recursive: true });

    await execFileAsync('pg_dump', [
      connStr,
      '-f', safetyDump,
      '--no-owner',
      '--no-acl',
      '--clean',
      '--if-exists',
    ]);

    backupPhotos(photoDir, safetyDir);

    fs.writeFileSync(restoreSql, files['openbin.sql']);

    await closeDb();

    // Drop and recreate public schema to handle old dumps without --clean
    await execFileAsync('psql', [
      connStr,
      '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
    ]);

    await execFileAsync('psql', [
      connStr,
      '-v', 'ON_ERROR_STOP=1',
      '-f', restoreSql,
    ]);

    restorePhotos(files, photoDir);
    await reinitialize();

    fs.rmSync(safetyDir, { recursive: true, force: true });
    log.info('PostgreSQL backup restored successfully');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('PostgreSQL restore failed:', message);

    if (fs.existsSync(safetyDump)) {
      try {
        log.info('Attempting rollback from safety dump...');
        await execFileAsync('psql', [
          connStr,
          '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
        ]);
        await execFileAsync('psql', [
          connStr,
          '-v', 'ON_ERROR_STOP=1',
          '-f', safetyDump,
        ]);
        log.info('Rollback succeeded');
      } catch (rollbackErr) {
        log.error('Rollback also failed:', rollbackErr instanceof Error ? rollbackErr.message : rollbackErr);
      }
    }

    try { await reinitialize(); } catch (reinitErr) {
      log.error('Failed to reinitialize DB after restore failure:', reinitErr instanceof Error ? reinitErr.message : reinitErr);
    }
    return { success: false, error: message };
  } finally {
    try { fs.unlinkSync(restoreSql); } catch { /* best effort */ }
    restoreInProgress = false;
  }
}

// ── Shared helpers ──────────────────────────────────────────────────

function backupPhotos(photoDir: string, safetyDir: string): void {
  if (!fs.existsSync(photoDir)) return;
  const dest = path.join(safetyDir, 'photos');
  try {
    fs.renameSync(photoDir, dest);
  } catch {
    fs.cpSync(photoDir, dest, { recursive: true });
  }
}

function restorePhotos(files: Record<string, Uint8Array>, photoDir: string): void {
  const photoPrefix = 'photos/';
  for (const [name, data] of Object.entries(files)) {
    if (!name.startsWith(photoPrefix) || name === photoPrefix) continue;
    const relativePath = name.slice(photoPrefix.length);
    const destPath = safePath(photoDir, relativePath);
    if (!destPath) continue;
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, data);
  }
}
