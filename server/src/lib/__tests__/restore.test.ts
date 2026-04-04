import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, getDialect, reinitialize } from '../../db.js';
import { restoreBackup } from '../restore.js';

function buildZip(entries: Record<string, string | Uint8Array>): Buffer {
  const input: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(entries)) {
    input[name] = typeof data === 'string' ? Buffer.from(data) : data;
  }
  return Buffer.from(zipSync(input));
}

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
    closeDb: vi.fn(async () => {}),
    reinitialize: vi.fn(async () => ({})),
  };
});

const mockGetDialect = vi.mocked(getDialect);
const mockCloseDb = vi.mocked(closeDb);
const mockReinitialize = vi.mocked(reinitialize);

async function setConfig(overrides: Record<string, unknown>) {
  const mod = await import('../config.js');
  Object.assign(mod.config, overrides);
}

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openbin-restore-test-'));
}

describe('restoreBackup', () => {
  let tmpDir: string;
  let dbDir: string;

  beforeEach(async () => {
    tmpDir = makeTmpDir();
    dbDir = path.join(tmpDir, 'data');
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(path.join(dbDir, 'openbin.db'), 'existing-db');

    await setConfig({
      databasePath: path.join(dbDir, 'openbin.db'),
      photoStoragePath: path.join(tmpDir, 'photos'),
      backupPath: path.join(tmpDir, 'backups'),
    });

    mockGetDialect.mockReturnValue('sqlite');
    mockCloseDb.mockClear();
    mockReinitialize.mockClear();
    mockExecFile.mockClear();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects ZIP with neither openbin.db nor openbin.sql', async () => {
    const zip = buildZip({ 'readme.txt': 'nothing useful' });
    const zipPath = path.join(tmpDir, 'bad.zip');
    fs.writeFileSync(zipPath, zip);

    const result = await restoreBackup(zipPath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not contain');
  });

  it('rejects PG backup when running SQLite', async () => {
    mockGetDialect.mockReturnValue('sqlite');
    const zip = buildZip({ 'openbin.sql': 'CREATE TABLE test();' });
    const zipPath = path.join(tmpDir, 'pg.zip');
    fs.writeFileSync(zipPath, zip);

    const result = await restoreBackup(zipPath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot restore a PostgreSQL backup into a SQLite database');
  });

  it('rejects SQLite backup when running PostgreSQL', async () => {
    mockGetDialect.mockReturnValue('postgres');
    const zip = buildZip({ 'openbin.db': 'sqlite-data' });
    const zipPath = path.join(tmpDir, 'sqlite.zip');
    fs.writeFileSync(zipPath, zip);

    const result = await restoreBackup(zipPath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot restore a SQLite backup into a PostgreSQL database');
  });

  describe('SQLite restore', () => {
    it('restores openbin.db and calls reinitialize', async () => {
      const zip = buildZip({ 'openbin.db': 'restored-db-content' });
      const zipPath = path.join(tmpDir, 'backup.zip');
      fs.writeFileSync(zipPath, zip);

      const result = await restoreBackup(zipPath);

      expect(result.success).toBe(true);
      expect(mockCloseDb).toHaveBeenCalled();
      expect(mockReinitialize).toHaveBeenCalled();

      const dbContent = fs.readFileSync(path.join(dbDir, 'openbin.db'), 'utf8');
      expect(dbContent).toBe('restored-db-content');
    });

    it('restores photos from ZIP', async () => {
      const zip = buildZip({
        'openbin.db': 'db-data',
        'photos/abc.jpg': 'photo-data',
      });
      const zipPath = path.join(tmpDir, 'backup.zip');
      fs.writeFileSync(zipPath, zip);

      const result = await restoreBackup(zipPath);
      expect(result.success).toBe(true);

      const photoPath = path.join(tmpDir, 'photos', 'abc.jpg');
      expect(fs.existsSync(photoPath)).toBe(true);
      expect(fs.readFileSync(photoPath, 'utf8')).toBe('photo-data');
    });

    it('cleans up safety backup on success', async () => {
      const zip = buildZip({ 'openbin.db': 'db-data' });
      const zipPath = path.join(tmpDir, 'backup.zip');
      fs.writeFileSync(zipPath, zip);

      await restoreBackup(zipPath);

      const safetyDir = path.join(dbDir, '.pre-restore-backup');
      expect(fs.existsSync(safetyDir)).toBe(false);
    });
  });

  describe('PostgreSQL restore', () => {
    beforeEach(async () => {
      mockGetDialect.mockReturnValue('postgres');
      await setConfig({ databaseUrl: 'postgresql://localhost/testdb' });

      // Default mock: pg_dump writes a file, psql succeeds
      mockExecFile.mockImplementation((cmd: string, args: string[], cb: any) => {
        if (cmd === 'pg_dump') {
          const fIdx = args.indexOf('-f');
          if (fIdx >= 0) {
            fs.writeFileSync(args[fIdx + 1], '-- safety dump');
          }
        }
        cb(null, '', '');
      });
    });

    afterEach(async () => {
      await setConfig({ databaseUrl: null });
    });

    it('calls pg_dump for safety backup then psql for restore', async () => {
      const zip = buildZip({ 'openbin.sql': 'CREATE TABLE test();' });
      const zipPath = path.join(tmpDir, 'pg-backup.zip');
      fs.writeFileSync(zipPath, zip);

      const result = await restoreBackup(zipPath);
      expect(result.success).toBe(true);

      // pg_dump called for safety backup
      expect(mockExecFile).toHaveBeenCalledWith(
        'pg_dump',
        expect.arrayContaining(['--clean', '--if-exists']),
        expect.any(Function),
      );

      // psql called to drop schema
      expect(mockExecFile).toHaveBeenCalledWith(
        'psql',
        expect.arrayContaining(['-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;']),
        expect.any(Function),
      );

      // psql called to replay dump
      expect(mockExecFile).toHaveBeenCalledWith(
        'psql',
        expect.arrayContaining(['-v', 'ON_ERROR_STOP=1', '-f', expect.stringContaining('openbin.sql')]),
        expect.any(Function),
      );

      expect(mockCloseDb).toHaveBeenCalled();
      expect(mockReinitialize).toHaveBeenCalled();
    });

    it('attempts rollback when psql restore fails', async () => {
      mockExecFile.mockImplementation((cmd: string, args: string[], cb: any) => {
        if (cmd === 'pg_dump') {
          const fIdx = args.indexOf('-f');
          if (fIdx >= 0) {
            fs.writeFileSync(args[fIdx + 1], '-- safety dump');
          }
          cb(null, '', '');
          return;
        }
        // psql -f openbin.sql fails; all other psql calls succeed
        if (cmd === 'psql' && args.includes('-f')) {
          const fIdx = args.indexOf('-f');
          if (args[fIdx + 1].endsWith('openbin.sql')) {
            cb(new Error('psql: ERROR: syntax error'), '', '');
            return;
          }
        }
        cb(null, '', '');
      });

      const zip = buildZip({ 'openbin.sql': 'BAD SQL;' });
      const zipPath = path.join(tmpDir, 'bad-pg.zip');
      fs.writeFileSync(zipPath, zip);

      const result = await restoreBackup(zipPath);
      expect(result.success).toBe(false);
      expect(result.error).toContain('syntax error');

      expect(mockReinitialize).toHaveBeenCalled();
    });
  });
});
