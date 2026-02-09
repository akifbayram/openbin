import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateExportData,
  parseImportFile,
  ImportError,
  MAX_IMPORT_SIZE,
} from '../exportImport';
import type { ExportDataV2 } from '@/types';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

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
    dataBase64: 'aGVsbG8=',
    filename: 'test.jpg',
    mimeType: 'image/jpeg',
    size: 5,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
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
