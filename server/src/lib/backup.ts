import { execFile as execFileCb } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import archiver from 'archiver';
import cron from 'node-cron';
import { getSqliteDb } from '../db/sqlite.js';
import { getDialect } from '../db.js';
import { config as appConfig } from './config.js';
import { createLogger } from './logger.js';

const execFileAsync = promisify(execFileCb);

const log = createLogger('backup');

const SCHEDULE_PRESETS: Record<string, string> = {
  hourly: '0 * * * *',
  daily: '0 2 * * *',
  weekly: '0 2 * * 0',
};

export interface BackupConfig {
  enabled: boolean;
  schedule: string;
  retention: number;
  backupPath: string;
  webhookUrl: string;
}

export function getConfig(): BackupConfig {
  return {
    enabled: appConfig.backupEnabled,
    schedule: appConfig.backupInterval,
    retention: appConfig.backupRetention,
    backupPath: appConfig.backupPath,
    webhookUrl: appConfig.backupWebhookUrl,
  };
}

export function resolveSchedule(interval: string): string | null {
  if (SCHEDULE_PRESETS[interval]) return SCHEDULE_PRESETS[interval];
  if (cron.validate(interval)) return interval;
  return null;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function notifyWebhook(url: string, error: Error): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'backup_failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    log.error('Webhook notification failed:', err);
  }
}

export async function runBackup(config?: Partial<BackupConfig>): Promise<string> {
  const cfg = { ...getConfig(), ...config };
  fs.mkdirSync(cfg.backupPath, { recursive: true, mode: 0o700 });

  const timestamp = formatTimestamp(new Date());
  const filename = `backup-${timestamp}.zip`;
  const zipPath = path.join(cfg.backupPath, filename);
  const tempDbPath = path.join(cfg.backupPath, `.tmp-backup-${timestamp}.db`);

  try {
    if (getDialect() === 'sqlite') {
      // Snapshot the database using SQLite's online backup API
      await getSqliteDb().backup(tempDbPath);
    } else {
      // PostgreSQL: dump to SQL file using pg_dump
      const dumpPath = tempDbPath.replace(/\.db$/, '.sql');
      await execFileAsync('pg_dump', [
        appConfig.databaseUrl!,
        '-f', dumpPath,
        '--no-owner',
        '--no-acl',
      ]);
      // Use SQL dump instead of DB file for archive
      // We need to adjust the archive entry below
    }

    // Create ZIP archive
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      if (getDialect() === 'sqlite') {
        archive.file(tempDbPath, { name: 'openbin.db' });
      } else {
        const dumpPath = tempDbPath.replace(/\.db$/, '.sql');
        archive.file(dumpPath, { name: 'openbin.sql' });
      }

      const photoDir = appConfig.photoStoragePath;
      if (appConfig.storageBackend === 's3') {
        log.warn('Photos stored in S3 are not included in local backups — use S3 versioning or cross-region replication');
      } else if (fs.existsSync(photoDir)) {
        archive.directory(photoDir, 'photos');
      }

      archive.finalize();
    });

    // Restrict backup file permissions (contains DB with password hashes)
    fs.chmodSync(zipPath, 0o600);

    // Clean up temp files
    const filesToClean = getDialect() === 'sqlite'
      ? [tempDbPath]
      : [tempDbPath.replace(/\.db$/, '.sql')];
    for (const f of filesToClean) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }

    // Prune old backups
    pruneBackups(cfg.backupPath, cfg.retention);

    log.info(`Created ${filename}`);
    return zipPath;
  } catch (err) {
    // Clean up partial files
    const filesToClean = getDialect() === 'sqlite'
      ? [tempDbPath]
      : [tempDbPath.replace(/\.db$/, '.sql')];
    for (const f of filesToClean) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    const error = err instanceof Error ? err : new Error(String(err));
    log.error('Backup failed:', error.message);

    if (cfg.webhookUrl) {
      await notifyWebhook(cfg.webhookUrl, error);
    }

    throw error;
  }
}

export function pruneBackups(backupPath: string, retention: number): void {
  const files = fs.readdirSync(backupPath)
    .filter(f => /^backup-.*\.zip$/.test(f))
    .sort();

  if (files.length <= retention) return;

  const toDelete = files.slice(0, files.length - retention);
  for (const file of toDelete) {
    try {
      fs.unlinkSync(path.join(backupPath, file));
      log.info(`Pruned ${file}`);
    } catch (err) {
      log.error(`Failed to prune ${file}:`, err);
    }
  }
}

let scheduledTask: cron.ScheduledTask | null = null;

export function startBackupScheduler(): void {
  const cfg = getConfig();

  if (!cfg.enabled) {
    log.info('Scheduled backups disabled');
    return;
  }

  const cronExpr = resolveSchedule(cfg.schedule);
  if (!cronExpr) {
    log.error(`Invalid schedule: "${cfg.schedule}". Backups will not run.`);
    return;
  }

  scheduledTask = cron.schedule(cronExpr, async () => {
    try {
      await runBackup();
    } catch {
      // Error already logged in runBackup
    }
  });

  log.info(`Scheduled with cron "${cronExpr}" (${cfg.schedule}), retention=${cfg.retention}`);
}

export function stopBackupScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
