import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveSchedule,
  getConfig,
  runBackup,
  pruneBackups,
  startBackupScheduler,
  stopBackupScheduler,
} from '../backup.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openbin-backup-test-'));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('resolveSchedule', () => {
  it('maps "daily" to 2 AM cron', () => {
    expect(resolveSchedule('daily')).toBe('0 2 * * *');
  });

  it('maps "weekly" to Sunday 2 AM cron', () => {
    expect(resolveSchedule('weekly')).toBe('0 2 * * 0');
  });

  it('maps "hourly" to top-of-hour cron', () => {
    expect(resolveSchedule('hourly')).toBe('0 * * * *');
  });

  it('passes through a valid raw cron expression', () => {
    expect(resolveSchedule('*/15 * * * *')).toBe('*/15 * * * *');
  });

  it('returns null for an invalid expression', () => {
    expect(resolveSchedule('not-a-cron')).toBeNull();
  });
});

describe('getConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns defaults when env vars are unset', () => {
    delete process.env.BACKUP_ENABLED;
    delete process.env.BACKUP_INTERVAL;
    delete process.env.BACKUP_RETENTION;
    delete process.env.BACKUP_PATH;
    delete process.env.BACKUP_WEBHOOK_URL;

    const cfg = getConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.schedule).toBe('daily');
    expect(cfg.retention).toBe(7);
    expect(cfg.backupPath).toBe('./data/backups');
    expect(cfg.webhookUrl).toBe('');
  });

  it('reads env vars when set', () => {
    process.env.BACKUP_ENABLED = 'true';
    process.env.BACKUP_INTERVAL = 'hourly';
    process.env.BACKUP_RETENTION = '3';
    process.env.BACKUP_PATH = '/tmp/backups';
    process.env.BACKUP_WEBHOOK_URL = 'https://example.com/hook';

    const cfg = getConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.schedule).toBe('hourly');
    expect(cfg.retention).toBe(3);
    expect(cfg.backupPath).toBe('/tmp/backups');
    expect(cfg.webhookUrl).toBe('https://example.com/hook');
  });

  it('clamps retention to at least 1', () => {
    process.env.BACKUP_RETENTION = '0';
    expect(getConfig().retention).toBe(1);

    process.env.BACKUP_RETENTION = '-5';
    expect(getConfig().retention).toBe(1);
  });
});

describe('runBackup', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('creates a ZIP containing openbin.db', async () => {
    const zipPath = await runBackup({ backupPath: tmpDir, retention: 10 });

    expect(fs.existsSync(zipPath)).toBe(true);
    expect(path.basename(zipPath)).toMatch(/^backup-.*\.zip$/);

    // Verify ZIP is non-empty
    const stat = fs.statSync(zipPath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('cleans up temp DB file after successful backup', async () => {
    await runBackup({ backupPath: tmpDir, retention: 10 });

    const tmpFiles = fs.readdirSync(tmpDir).filter(f => f.startsWith('.tmp-'));
    expect(tmpFiles).toHaveLength(0);
  });
});

describe('pruneBackups', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('deletes oldest backups beyond retention count', () => {
    // Create 5 fake backup files
    for (let i = 1; i <= 5; i++) {
      fs.writeFileSync(
        path.join(tmpDir, `backup-2026-01-0${i}T020000.zip`),
        'fake'
      );
    }

    pruneBackups(tmpDir, 3);

    const remaining = fs.readdirSync(tmpDir).filter(f => f.endsWith('.zip')).sort();
    expect(remaining).toHaveLength(3);
    expect(remaining[0]).toBe('backup-2026-01-03T020000.zip');
    expect(remaining[2]).toBe('backup-2026-01-05T020000.zip');
  });

  it('does nothing when file count is within retention', () => {
    for (let i = 1; i <= 2; i++) {
      fs.writeFileSync(
        path.join(tmpDir, `backup-2026-01-0${i}T020000.zip`),
        'fake'
      );
    }

    pruneBackups(tmpDir, 5);

    const remaining = fs.readdirSync(tmpDir).filter(f => f.endsWith('.zip'));
    expect(remaining).toHaveLength(2);
  });

  it('ignores non-backup files', () => {
    fs.writeFileSync(path.join(tmpDir, 'notes.txt'), 'keep');
    fs.writeFileSync(path.join(tmpDir, 'backup-2026-01-01T020000.zip'), 'fake');

    pruneBackups(tmpDir, 1);

    expect(fs.existsSync(path.join(tmpDir, 'notes.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'backup-2026-01-01T020000.zip'))).toBe(true);
  });
});

describe('startBackupScheduler', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    stopBackupScheduler();
    process.env = { ...originalEnv };
  });

  it('does not start when BACKUP_ENABLED is not true', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    delete process.env.BACKUP_ENABLED;

    startBackupScheduler();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('disabled')
    );
    logSpy.mockRestore();
  });

  it('logs error for invalid schedule without throwing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.BACKUP_ENABLED = 'true';
    process.env.BACKUP_INTERVAL = 'not-valid';

    expect(() => startBackupScheduler()).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid schedule')
    );
    errorSpy.mockRestore();
  });

  it('starts successfully with a valid schedule', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.BACKUP_ENABLED = 'true';
    process.env.BACKUP_INTERVAL = 'daily';

    startBackupScheduler();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Scheduled with cron')
    );
    logSpy.mockRestore();
  });
});
