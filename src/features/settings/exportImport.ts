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
  a.download = `openbin-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportZip(locationId: string): Promise<void> {
  const resp = await fetch(`/api/locations/${encodeURIComponent(locationId)}/export/zip`, {
    credentials: 'same-origin',
  });
  if (!resp.ok) throw new Error('ZIP export failed');
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `openbin-export-${date}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportCsv(locationId: string): Promise<void> {
  const resp = await fetch(`/api/locations/${encodeURIComponent(locationId)}/export/csv`, {
    credentials: 'same-origin',
  });
  if (!resp.ok) throw new Error('CSV export failed');
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `openbin-bins-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isISODate(s: unknown): boolean {
  return typeof s === 'string' && !Number.isNaN(Date.parse(s));
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
        (bin.items as unknown[]).every((i) => typeof i === 'string' || (typeof i === 'object' && i !== null && typeof (i as Record<string, unknown>).name === 'string')) &&
        typeof bin.notes === 'string'
      );
    }
    return typeof bin.contents === 'string';
  });
  if (!binsValid) return false;

  // Validate trashed bins if present (same shape as bins)
  if (d.trashedBins !== undefined && !Array.isArray(d.trashedBins)) return false;

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
  trashedBinsImported?: number;
  photosImported: number;
  photosSkipped: number;
  areasImported?: number;
  pinsImported?: number;
  viewsImported?: number;
  membersImported?: number;
  settingsApplied?: boolean;
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

  // Pass all V2 export sections to the server
  return apiFetch<ImportResult>(`/api/locations/${locationId}/import`, {
    method: 'POST',
    body: {
      bins,
      trashedBins: d.trashedBins,
      mode,
      tagColors: d.tagColors,
      customFieldDefinitions: d.customFieldDefinitions,
      locationSettings: d.locationSettings,
      areas: d.areas,
      pinnedBins: d.pinnedBins,
      savedViews: d.savedViews,
      members: d.members,
    },
  });
}

export interface CSVImportResult {
  binsImported: number;
  binsSkipped: number;
  itemsImported: number;
}

/** Read CSV header (first line, handling quoted fields). */
export function parseCSVHeader(text: string): string[] {
  let end = 0;
  let inQuoted = false;
  while (end < text.length) {
    const ch = text[end];
    if (ch === '"') inQuoted = !inQuoted;
    else if (!inQuoted && (ch === '\n' || ch === '\r')) break;
    end++;
  }
  return text.slice(0, end).split(',').map(h => h.trim());
}

/** Split a single CSV line into fields, respecting quoted values. */
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuoted) {
      if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      inQuoted = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

/** Quick preview count: number of bins and items in the CSV. */
export function countCSVBins(text: string): { bins: number; items: number } {
  const lines = text.split('\n');
  if (lines.length < 2) return { bins: 0, items: 0 };

  const header = parseCSVHeader(text).map(h => h.toLowerCase());
  const isRoundTrip =
    header.length === 5 &&
    header[0] === 'bin name' &&
    header[2] === 'item';

  if (isRoundTrip) {
    const seen = new Set<string>();
    let items = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = splitCSVLine(line);
      const key = `${parts[0] ?? ''}::${parts[1] ?? ''}`;
      seen.add(key);
      if ((parts[2] ?? '').trim()) items++;
    }
    return { bins: seen.size, items };
  }

  // One-bin-per-row
  let bins = 0;
  let items = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    bins++;
    const parts = splitCSVLine(line);
    const itemsCell = (parts[2] ?? '').trim();
    if (itemsCell) {
      items += itemsCell.split(';').filter(s => s.trim()).length;
    }
  }
  return { bins, items };
}

/** Validate that a CSV file has a recognized header format. */
export function validateCSVHeader(text: string): boolean {
  const header = parseCSVHeader(text).map(h => h.toLowerCase());
  const isRoundTrip =
    header.length === 5 &&
    header[0] === 'bin name' &&
    header[1] === 'area' &&
    header[2] === 'item' &&
    header[3] === 'quantity' &&
    header[4] === 'tags';
  const isOneBinPerRow =
    header.length === 4 &&
    (header[0] === 'bin name' || header[0] === 'name') &&
    header[1] === 'area' &&
    header[2] === 'items' &&
    header[3] === 'tags';
  return isRoundTrip || isOneBinPerRow;
}

export async function importCSV(
  locationId: string,
  file: File,
  mode: 'merge' | 'replace',
): Promise<CSVImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);
  return apiFetch<CSVImportResult>(
    `/api/locations/${locationId}/import/csv`,
    { method: 'POST', body: formData },
  );
}

export async function importZip(
  locationId: string,
  file: File,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);
  return apiFetch<ImportResult>(
    `/api/locations/${locationId}/import/zip`,
    { method: 'POST', body: formData },
  );
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
