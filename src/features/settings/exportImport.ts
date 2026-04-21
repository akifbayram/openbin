import { apiFetch } from '@/lib/api';
import type { ExportData } from '@/types';

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

async function fetchAndDownload(url: string, filename: string): Promise<void> {
  const resp = await fetch(url, { credentials: 'same-origin' });
  if (!resp.ok) throw new Error(`Export failed (${resp.status})`);
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export async function exportAllData(locationId: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  await fetchAndDownload(`/api/locations/${encodeURIComponent(locationId)}/export`, `openbin-backup-${date}.json`);
}

export async function exportZip(locationId: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  await fetchAndDownload(`/api/locations/${encodeURIComponent(locationId)}/export/zip`, `openbin-export-${date}.zip`);
}

export async function exportCsv(locationId: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  await fetchAndDownload(`/api/locations/${encodeURIComponent(locationId)}/export/csv`, `openbin-bins-${date}.csv`);
}

function isISODate(s: unknown): boolean {
  return typeof s === 'string' && !Number.isNaN(Date.parse(s));
}

export function validateExportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.version !== 2) return false;
  if (typeof d.exportedAt !== 'string') return false;
  if (!Array.isArray(d.bins)) return false;

  const binsValid = d.bins.every((b: unknown) => {
    if (!b || typeof b !== 'object') return false;
    const bin = b as Record<string, unknown>;
    return (
      typeof bin.id === 'string' &&
      typeof bin.name === 'string' &&
      Array.isArray(bin.tags) &&
      (bin.tags as unknown[]).every((t) => typeof t === 'string') &&
      isISODate(bin.createdAt) &&
      isISODate(bin.updatedAt) &&
      Array.isArray(bin.items) &&
      (bin.items as unknown[]).every((i) => typeof i === 'string' || (typeof i === 'object' && i !== null && typeof (i as Record<string, unknown>).name === 'string')) &&
      typeof bin.notes === 'string'
    );
  });
  if (!binsValid) return false;

  // Validate trashed bins if present (same shape as bins)
  if (d.trashedBins !== undefined && !Array.isArray(d.trashedBins)) return false;

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
  return apiFetch<ImportResult>(`/api/locations/${locationId}/import`, {
    method: 'POST',
    body: {
      bins: data.bins,
      trashedBins: data.trashedBins,
      mode,
      tagColors: data.tagColors,
      customFieldDefinitions: data.customFieldDefinitions,
      locationSettings: data.locationSettings,
      areas: data.areas,
      pinnedBins: data.pinnedBins,
      savedViews: data.savedViews,
      members: data.members,
    },
  });
}

export interface CSVImportResult {
  binsImported: number;
  binsSkipped: number;
  itemsImported: number;
}

/** Read CSV header (first line, handling quoted fields). */
function parseCSVHeader(text: string): string[] {
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
