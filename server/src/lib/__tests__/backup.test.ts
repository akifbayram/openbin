import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDialect } from '../../db.js';
import {
  getConfig,
  pruneBackups,
  resolveSchedule,
  runBackup,
  startBackupScheduler,
  stopBackupScheduler,
} from '../backup.js';

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
    cb(null, '', '');
  }),
}));

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}));

vi.mock('../config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config.js')>();
  return {
    ...original,
    config: { ...original.config },
  };
});

vi.mock('../../db.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../db.js')>();
  return {
    ...original,
    getDialect: vi.fn(() => 'sqlite'),
  };
});

const mockGetDialect = vi.mocked(getDialect);

async function setBackupConfig(overrides: Record<string, unknown>) {
  const mod = await import('../config.js');
  Object.assign(mod.config, overrides);
}

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
  it('returns defaults when config has defaults', () => {
    const cfg = getConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.schedule).toBe('daily');
    expect(cfg.retention).toBe(7);
    expect(cfg.backupPath).toBe('backups');
    expect(cfg.webhookUrl).toBe('');
  });

  it('reads values from config', async () => {
    await setBackupConfig({
      backupEnabled: true,
      backupInterval: 'hourly',
      backupRetention: 3,
      backupPath: '/tmp/backups',
      backupWebhookUrl: 'https://example.com/hook',
    });

    const cfg = getConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.schedule).toBe('hourly');
    expect(cfg.retention).toBe(3);
    expect(cfg.backupPath).toBe('/tmp/backups');
    expect(cfg.webhookUrl).toBe('https://example.com/hook');

    // Reset
    await setBackupConfig({
      backupEnabled: false,
      backupInterval: 'daily',
      backupRetention: 7,
      backupPath: './data/backups',
      backupWebhookUrl: '',
    });
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
  afterEach(async () => {
    stopBackupScheduler();
    await setBackupConfig({
      backupEnabled: false,
      backupInterval: 'daily',
      backupRetention: 7,
      backupPath: './data/backups',
      backupWebhookUrl: '',
    });
  });

  it('does not start when backup is disabled', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    startBackupScheduler();

    expect(logSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('disabled')
    );
    logSpy.mockRestore();
  });

  it('logs error for invalid schedule without throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await setBackupConfig({ backupEnabled: true, backupInterval: 'not-valid' });

    expect(() => startBackupScheduler()).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Invalid schedule')
    );
    errorSpy.mockRestore();
  });

  it('starts successfully with a valid schedule', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await setBackupConfig({ backupEnabled: true, backupInterval: 'daily' });

    startBackupScheduler();

    expect(logSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Scheduled with cron')
    );
    logSpy.mockRestore();
  });
});

describe('runBackup (PostgreSQL)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = makeTmpDir();
    mockGetDialect.mockReturnValue('postgres');
    mockExecFile.mockClear();
    await setBackupConfig({ databaseUrl: 'postgresql://localhost/testdb' });
  });

  afterEach(async () => {
    cleanup(tmpDir);
    mockGetDialect.mockReturnValue('sqlite');
    await setBackupConfig({ databaseUrl: null });
  });

  it('creates a ZIP containing openbin.sql via pg_dump', async () => {
    mockExecFile.mockImplementation((_cmd: string, args: string[], cb: any) => {
      const fIdx = args.indexOf('-f');
      if (fIdx >= 0) {
        fs.writeFileSync(args[fIdx + 1], '-- pg_dump output\nCREATE TABLE test();');
      }
      cb(null, '', '');
    });

    const zipPath = await runBackup({ backupPath: tmpDir, retention: 10 });

    expect(fs.existsSync(zipPath)).toBe(true);
    expect(path.basename(zipPath)).toMatch(/^backup-.*\.zip$/);

    expect(mockExecFile).toHaveBeenCalledWith(
      'pg_dump',
      expect.arrayContaining(['--clean', '--if-exists', '--no-owner', '--no-acl']),
      expect.any(Function),
    );
  });

  it('cleans up temp SQL file after successful PG backup', async () => {
    mockExecFile.mockImplementation((_cmd: string, args: string[], cb: any) => {
      const fIdx = args.indexOf('-f');
      if (fIdx >= 0) {
        fs.writeFileSync(args[fIdx + 1], '-- dump');
      }
      cb(null, '', '');
    });

    await runBackup({ backupPath: tmpDir, retention: 10 });

    const tmpFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.sql'));
    expect(tmpFiles).toHaveLength(0);
  });

  it('throws when pg_dump produces an empty file', async () => {
    mockExecFile.mockImplementation((_cmd: string, args: string[], cb: any) => {
      const fIdx = args.indexOf('-f');
      if (fIdx >= 0) {
        fs.writeFileSync(args[fIdx + 1], '');
      }
      cb(null, '', '');
    });

    await expect(runBackup({ backupPath: tmpDir, retention: 10 }))
      .rejects.toThrow('pg_dump produced an empty dump file');
  });
});
