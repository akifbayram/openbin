import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import cron from 'node-cron';
import { getDb } from '../db.js';
import { config as appConfig } from './config.js';

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
  const rawRetention = parseInt(process.env.BACKUP_RETENTION || '7', 10);
  return {
    enabled: process.env.BACKUP_ENABLED === 'true' || process.env.BACKUP_ENABLED === '1',
    schedule: process.env.BACKUP_INTERVAL || 'daily',
    retention: Number.isFinite(rawRetention) ? Math.max(1, Math.min(rawRetention, 365)) : 7,
    backupPath: process.env.BACKUP_PATH || './data/backups',
    webhookUrl: process.env.BACKUP_WEBHOOK_URL || '',
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
    console.error('[backup] Webhook notification failed:', err);
  }
}

export async function runBackup(config?: Partial<BackupConfig>): Promise<string> {
  const cfg = { ...getConfig(), ...config };
  fs.mkdirSync(cfg.backupPath, { recursive: true });

  const timestamp = formatTimestamp(new Date());
  const filename = `backup-${timestamp}.zip`;
  const zipPath = path.join(cfg.backupPath, filename);
  const tempDbPath = path.join(cfg.backupPath, `.tmp-backup-${timestamp}.db`);

  try {
    // Snapshot the database using SQLite's online backup API
    await getDb().backup(tempDbPath);

    // Create ZIP archive
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.file(tempDbPath, { name: 'openbin.db' });

      const photoDir = appConfig.photoStoragePath;
      if (fs.existsSync(photoDir)) {
        archive.directory(photoDir, 'photos');
      }

      archive.finalize();
    });

    // Clean up temp DB
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

    // Prune old backups
    pruneBackups(cfg.backupPath, cfg.retention);

    console.log(`[backup] Created ${filename}`);
    return zipPath;
  } catch (err) {
    // Clean up partial files
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[backup] Backup failed:', error.message);

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
      console.log(`[backup] Pruned ${file}`);
    } catch (err) {
      console.error(`[backup] Failed to prune ${file}:`, err);
    }
  }
}

let scheduledTask: cron.ScheduledTask | null = null;

export function startBackupScheduler(): void {
  const cfg = getConfig();

  if (!cfg.enabled) {
    console.log('[backup] Scheduled backups disabled');
    return;
  }

  const cronExpr = resolveSchedule(cfg.schedule);
  if (!cronExpr) {
    console.error(`[backup] Invalid schedule: "${cfg.schedule}". Backups will not run.`);
    return;
  }

  scheduledTask = cron.schedule(cronExpr, async () => {
    try {
      await runBackup();
    } catch {
      // Error already logged in runBackup
    }
  });

  console.log(`[backup] Scheduled with cron "${cronExpr}" (${cfg.schedule}), retention=${cfg.retention}`);
}

export function stopBackupScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
