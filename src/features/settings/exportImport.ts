import { apiFetch } from '@/lib/api';
import type { ExportData, ExportDataV2 } from '@/types';

export const MAX_IMPORT_SIZE = 100 * 1024 * 1024;

export type ImportErrorCode = 'INVALID_JSON' | 'INVALID_FORMAT' | 'FILE_TOO_LARGE';

export class ImportError extends Error {
  code: ImportErrorCode;
  constructor(code: ImportErrorCode, message: string) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

export async function exportAllData(locationId: string): Promise<ExportDataV2> {
  return apiFetch<ExportDataV2>(`/api/locations/${locationId}/export`);
}

export function downloadExport(data: ExportData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sanduk-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportZip(locationId: string): Promise<void> {
  const token = localStorage.getItem('sanduk-token');
  const resp = await fetch(`/api/locations/${encodeURIComponent(locationId)}/export/zip`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error('ZIP export failed');
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sanduk-export-${date}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportCsv(locationId: string): Promise<void> {
  const token = localStorage.getItem('sanduk-token');
  const resp = await fetch(`/api/locations/${encodeURIComponent(locationId)}/export/csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error('CSV export failed');
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sanduk-bins-${date}.csv`;
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
  if (d.version !== 1 && d.version !== 2) return false;
  if (typeof d.exportedAt !== 'string') return false;
  if (!Array.isArray(d.bins)) return false;

  // photos is optional — server format nests them in bins; legacy format has top-level array
  if (d.photos !== undefined && !Array.isArray(d.photos)) return false;

  const isV2 = d.version === 2;

  const binsValid = d.bins.every((b: unknown) => {
    if (!b || typeof b !== 'object') return false;
    const bin = b as Record<string, unknown>;
    const baseValid =
      typeof bin.id === 'string' &&
      typeof bin.name === 'string' &&
      Array.isArray(bin.tags) &&
      (bin.tags as unknown[]).every((t) => typeof t === 'string') &&
      isISODate(bin.createdAt) &&
      isISODate(bin.updatedAt);
    if (!baseValid) return false;

    if (isV2) {
      return (
        Array.isArray(bin.items) &&
        (bin.items as unknown[]).every((i) => typeof i === 'string') &&
        typeof bin.notes === 'string'
      );
    }
    return typeof bin.contents === 'string';
  });
  if (!binsValid) return false;

  // Validate top-level photos if present (legacy format)
  if (Array.isArray(d.photos)) {
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
    if (!photosValid) return false;
  }

  return true;
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
  locationId: string,
  data: ExportData,
  mode: 'merge' | 'replace'
): Promise<ImportResult> {
  // Server expects { bins, mode } where bins have nested photos
  const d = data as unknown as Record<string, unknown>;
  const rawBins = (d.bins ?? []) as Record<string, unknown>[];

  // If legacy format with top-level photos, merge them into bins
  const topPhotos = d.photos;
  let bins: unknown[] = rawBins;
  if (Array.isArray(topPhotos) && topPhotos.length > 0) {
    const photosMap = new Map<string, { id: string; filename: string; mimeType: string; data: string }[]>();
    for (const p of topPhotos as Array<Record<string, unknown>>) {
      const binId = (p.binId as string) || '';
      const arr = photosMap.get(binId) || [];
      arr.push({
        id: p.id as string,
        filename: p.filename as string,
        mimeType: p.mimeType as string,
        data: p.dataBase64 as string,
      });
      photosMap.set(binId, arr);
    }
    bins = rawBins.map((bin) => ({
      ...bin,
      photos: photosMap.get(bin.id as string) || bin.photos || [],
    }));
  }

  return apiFetch<ImportResult>(`/api/locations/${locationId}/import`, {
    method: 'POST',
    body: { bins, mode },
  });
}

export async function importLegacyData(
  locationId: string,
  data: ExportData
): Promise<ImportResult> {
  return apiFetch<ImportResult>('/api/import/legacy', {
    method: 'POST',
    body: { locationId, data },
  });
}
