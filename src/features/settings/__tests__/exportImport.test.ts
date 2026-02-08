import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import {
  validateExportData,
  parseImportFile,
  importData,
  ImportError,
  MAX_IMPORT_SIZE,
} from '../exportImport';
import type { ExportDataV2 } from '@/types';

function makeValidExportData(overrides?: Partial<ExportDataV2>): ExportDataV2 {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    bins: [],
    photos: [],
    ...overrides,
  };
}

function makeExportBin(overrides?: Record<string, unknown>) {
  return {
    id: 'bin-1',
    name: 'Test Bin',
    items: ['Some item'],
    notes: 'Some notes',
    tags: ['tag1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeExportPhoto(overrides?: Record<string, unknown>) {
  return {
    id: 'photo-1',
    binId: 'bin-1',
    dataBase64: 'aGVsbG8=', // "hello" in base64
    filename: 'test.jpg',
    mimeType: 'image/jpeg',
    size: 5,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  await db.bins.clear();
  await db.photos.clear();
});

describe('validateExportData', () => {
  it('returns true for valid complete data', () => {
    const data = makeValidExportData({
      bins: [makeExportBin()],
      photos: [makeExportPhoto()],
    });
    expect(validateExportData(data)).toBe(true);
  });

  it('returns true for valid v1 data', () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      bins: [{
        id: 'bin-1',
        name: 'Test',
        contents: 'stuff',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
      photos: [],
    };
    expect(validateExportData(data)).toBe(true);
  });

  it('returns false when version is missing', () => {
    const data = { exportedAt: 'x', bins: [], photos: [] };
    expect(validateExportData(data)).toBe(false);
  });

  it('returns false when bins array is missing', () => {
    const data = { version: 1, exportedAt: 'x', photos: [] };
    expect(validateExportData(data)).toBe(false);
  });

  it('returns false for invalid bin (missing name)', () => {
    const data = makeValidExportData({
      bins: [makeExportBin({ name: undefined })] as ExportDataV2['bins'],
    });
    expect(validateExportData(data)).toBe(false);
  });

  it('returns false for invalid photo (missing dataBase64)', () => {
    const data = makeValidExportData({
      photos: [makeExportPhoto({ dataBase64: undefined })] as ExportDataV2['photos'],
    });
    expect(validateExportData(data)).toBe(false);
  });

  it('returns true for empty bins and photos arrays', () => {
    const data = makeValidExportData();
    expect(validateExportData(data)).toBe(true);
  });
});

describe('parseImportFile', () => {
  it('parses valid JSON file correctly', async () => {
    const data = makeValidExportData({ bins: [makeExportBin()] });
    const file = new File([JSON.stringify(data)], 'backup.json', {
      type: 'application/json',
    });
    const result = await parseImportFile(file);
    expect(result.version).toBe(2);
    expect(result.bins).toHaveLength(1);
    expect(result.bins[0].name).toBe('Test Bin');
  });

  it('throws ImportError with INVALID_JSON for invalid JSON', async () => {
    const file = new File(['not json {{{'], 'bad.json', {
      type: 'application/json',
    });
    await expect(parseImportFile(file)).rejects.toThrow(ImportError);
    try {
      await parseImportFile(file);
    } catch (e) {
      expect((e as ImportError).code).toBe('INVALID_JSON');
    }
  });

  it('throws ImportError with INVALID_FORMAT for wrong schema', async () => {
    const file = new File([JSON.stringify({ foo: 'bar' })], 'wrong.json', {
      type: 'application/json',
    });
    await expect(parseImportFile(file)).rejects.toThrow(ImportError);
    try {
      await parseImportFile(file);
    } catch (e) {
      expect((e as ImportError).code).toBe('INVALID_FORMAT');
    }
  });

  it('throws ImportError with FILE_TOO_LARGE for oversized file', async () => {
    // Create a File object with a mocked size property
    const content = 'x';
    const file = new File([content], 'big.json', { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_SIZE + 1 });
    await expect(parseImportFile(file)).rejects.toThrow(ImportError);
    try {
      await parseImportFile(file);
    } catch (e) {
      expect((e as ImportError).code).toBe('FILE_TOO_LARGE');
    }
  });
});

describe('importData', () => {
  it('merge mode: imports new bins and skips existing', async () => {
    // Pre-populate with an existing bin
    const existingBin = {
      id: 'bin-1',
      name: 'Existing',
      items: [],
      notes: '',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.bins.add(existingBin);

    const data = makeValidExportData({
      bins: [
        makeExportBin({ id: 'bin-1', name: 'Import Bin 1' }),
        makeExportBin({ id: 'bin-2', name: 'Import Bin 2' }),
      ],
    });

    const result = await importData(data, 'merge');
    expect(result.binsImported).toBe(1);
    expect(result.binsSkipped).toBe(1);

    // The existing bin should retain its original name
    const bin1 = await db.bins.get('bin-1');
    expect(bin1?.name).toBe('Existing');

    // The new bin should be imported
    const bin2 = await db.bins.get('bin-2');
    expect(bin2?.name).toBe('Import Bin 2');
  });

  it('replace mode: clears all data then imports', async () => {
    // Pre-populate
    await db.bins.add({
      id: 'old-bin',
      name: 'Old',
      items: [],
      notes: '',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const data = makeValidExportData({
      bins: [makeExportBin({ id: 'new-bin', name: 'New Bin' })],
    });

    const result = await importData(data, 'replace');
    expect(result.binsImported).toBe(1);
    expect(result.binsSkipped).toBe(0);

    // Old bin should be gone
    const oldBin = await db.bins.get('old-bin');
    expect(oldBin).toBeUndefined();

    // New bin should exist
    const newBin = await db.bins.get('new-bin');
    expect(newBin?.name).toBe('New Bin');
  });

  it('orphan photos (binId not found) are skipped', async () => {
    const data = makeValidExportData({
      bins: [makeExportBin({ id: 'bin-1' })],
      photos: [
        makeExportPhoto({ id: 'photo-1', binId: 'bin-1' }),
        makeExportPhoto({ id: 'photo-orphan', binId: 'non-existent-bin' }),
      ],
    });

    const result = await importData(data, 'replace');
    expect(result.photosImported).toBe(1);
    expect(result.photosSkipped).toBe(1);

    const orphan = await db.photos.get('photo-orphan');
    expect(orphan).toBeUndefined();
  });

  it('imports v1 data and migrates contents to items', async () => {
    const v1Data = {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      bins: [{
        id: 'v1-bin',
        name: 'Legacy Bin',
        contents: 'item one\nitem two\n\nitem three',
        tags: ['legacy'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
      photos: [],
    };

    const result = await importData(v1Data, 'replace');
    expect(result.binsImported).toBe(1);

    const bin = await db.bins.get('v1-bin');
    expect(bin).toBeDefined();
    expect(bin!.items).toEqual(['item one', 'item two', 'item three']);
    expect(bin!.notes).toBe('');
  });

  it('duplicate photo IDs are skipped in merge mode', async () => {
    // Pre-populate a bin and photo
    await db.bins.add({
      id: 'bin-1',
      name: 'Bin',
      items: [],
      notes: '',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.photos.add({
      id: 'photo-1',
      binId: 'bin-1',
      data: new Blob(['existing']),
      filename: 'existing.jpg',
      mimeType: 'image/jpeg',
      size: 8,
      createdAt: new Date(),
    });

    const data = makeValidExportData({
      bins: [makeExportBin({ id: 'bin-1' })],
      photos: [
        makeExportPhoto({ id: 'photo-1', binId: 'bin-1' }),
        makeExportPhoto({ id: 'photo-2', binId: 'bin-1' }),
      ],
    });

    const result = await importData(data, 'merge');
    // bin-1 already exists => skipped; photo-1 already exists => skipped; photo-2 new => imported
    expect(result.binsSkipped).toBe(1);
    expect(result.photosSkipped).toBe(1);
    expect(result.photosImported).toBe(1);
  });
});
