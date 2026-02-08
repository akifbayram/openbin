import { db } from '@/db';
import type { Bin, Photo, ExportData, ExportedPhoto } from '@/types';

export const MAX_IMPORT_SIZE = 100 * 1024 * 1024; // 100 MB

export type ImportErrorCode = 'INVALID_JSON' | 'INVALID_FORMAT' | 'FILE_TOO_LARGE';

export class ImportError extends Error {
  code: ImportErrorCode;
  constructor(code: ImportErrorCode, message: string) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip data URL prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mimeType });
}

export async function exportAllData(): Promise<ExportData> {
  const bins = await db.bins.toArray();
  const photos = await db.photos.toArray();

  const exportedPhotos: ExportedPhoto[] = await Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      binId: p.binId,
      dataBase64: await blobToBase64(p.data),
      filename: p.filename,
      mimeType: p.mimeType,
      size: p.size,
      createdAt: p.createdAt.toISOString(),
    }))
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    bins: bins.map((b) => ({
      id: b.id,
      name: b.name,
      contents: b.contents,
      tags: b.tags,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })),
    photos: exportedPhotos,
  };
}

export function downloadExport(data: ExportData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qr-bin-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isISODate(s: unknown): boolean {
  return typeof s === 'string' && !isNaN(Date.parse(s));
}

export function validateExportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.version !== 1) return false;
  if (typeof d.exportedAt !== 'string') return false;
  if (!Array.isArray(d.bins)) return false;
  if (!Array.isArray(d.photos)) return false;

  const binsValid = d.bins.every((b: unknown) => {
    if (!b || typeof b !== 'object') return false;
    const bin = b as Record<string, unknown>;
    return (
      typeof bin.id === 'string' &&
      typeof bin.name === 'string' &&
      typeof bin.contents === 'string' &&
      Array.isArray(bin.tags) &&
      (bin.tags as unknown[]).every((t) => typeof t === 'string') &&
      isISODate(bin.createdAt) &&
      isISODate(bin.updatedAt)
    );
  });
  if (!binsValid) return false;

  const photosValid = (d.photos as unknown[]).every((p: unknown) => {
    if (!p || typeof p !== 'object') return false;
    const photo = p as Record<string, unknown>;
    return (
      typeof photo.id === 'string' &&
      typeof photo.binId === 'string' &&
      typeof photo.dataBase64 === 'string' &&
      typeof photo.filename === 'string' &&
      typeof photo.mimeType === 'string' &&
      typeof photo.size === 'number' &&
      isISODate(photo.createdAt)
    );
  });
  return photosValid;
}

export async function parseImportFile(file: File): Promise<ExportData> {
  if (file.size > MAX_IMPORT_SIZE) {
    throw new ImportError('FILE_TOO_LARGE', `File exceeds ${MAX_IMPORT_SIZE / 1024 / 1024} MB limit`);
  }
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ImportError('INVALID_JSON', 'File is not valid JSON');
  }
  if (!validateExportData(json)) {
    throw new ImportError('INVALID_FORMAT', 'File does not match the expected backup format');
  }
  return json;
}

export interface ImportResult {
  binsImported: number;
  binsSkipped: number;
  photosImported: number;
  photosSkipped: number;
}

export async function importData(
  data: ExportData,
  mode: 'merge' | 'replace'
): Promise<ImportResult> {
  const result: ImportResult = {
    binsImported: 0,
    binsSkipped: 0,
    photosImported: 0,
    photosSkipped: 0,
  };

  await db.transaction('rw', [db.bins, db.photos], async () => {
    if (mode === 'replace') {
      await db.photos.clear();
      await db.bins.clear();
    }

    const existingBinIds = new Set(
      mode === 'merge' ? (await db.bins.toCollection().primaryKeys()) : []
    );
    const existingPhotoIds = new Set(
      mode === 'merge' ? (await db.photos.toCollection().primaryKeys()) : []
    );

    const importedBinIds = new Set<string>();

    for (const b of data.bins) {
      if (mode === 'merge' && existingBinIds.has(b.id)) {
        result.binsSkipped++;
        continue;
      }
      const bin: Bin = {
        id: b.id,
        name: b.name,
        contents: b.contents,
        tags: b.tags,
        createdAt: new Date(b.createdAt),
        updatedAt: new Date(b.updatedAt),
      };
      await db.bins.add(bin);
      importedBinIds.add(b.id);
      result.binsImported++;
    }

    for (const p of data.photos) {
      if (mode === 'merge' && existingPhotoIds.has(p.id)) {
        result.photosSkipped++;
        continue;
      }
      // Skip orphan photos (bin not in DB)
      const binExists =
        importedBinIds.has(p.binId) || existingBinIds.has(p.binId);
      if (!binExists) {
        result.photosSkipped++;
        continue;
      }
      const photo: Photo = {
        id: p.id,
        binId: p.binId,
        data: base64ToBlob(p.dataBase64, p.mimeType),
        filename: p.filename,
        mimeType: p.mimeType,
        size: p.size,
        createdAt: new Date(p.createdAt),
      };
      await db.photos.add(photo);
      result.photosImported++;
    }
  });

  return result;
}
