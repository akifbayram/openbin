import type { TxQueryFn } from '../db.js';
import { query, withTransaction } from '../db.js';
import {
  type ExportArea,
  type ExportBin,
  type ExportLocationSettings,
  type ExportMember,
  type ExportPinnedBin,
  type ExportSavedView,
  importAreas,
  importLocationSettings,
  importMembers,
  importPhotos,
  importPinnedBins,
  importSavedViews,
  importTagColors,
  insertBinItems,
  insertBinWithShortCode,
  mapCustomFieldsToIds,
  replaceCleanup,
  resolveArea,
  resolveCreatedBy,
  resolveCustomFieldDefs,
} from './exportHelpers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DryRunBin {
  id?: string;
  name: string;
  items?: unknown[];
  tags?: string[];
}

export interface FullImportParams {
  locationId: string;
  userId: string;
  isAdmin: boolean;
  importMode: 'merge' | 'replace';
  bins: ExportBin[];
  trashedBins?: ExportBin[];
  tagColors?: Array<{ tag: string; color: string }>;
  customFieldDefinitions?: Array<{ name: string; position: number }>;
  locationSettings?: ExportLocationSettings;
  areas?: ExportArea[];
  pinnedBins?: ExportPinnedBin[];
  savedViews?: ExportSavedView[];
  members?: ExportMember[];
}

export interface FullImportResult {
  binsImported: number;
  binsSkipped: number;
  trashedBinsImported: number;
  photosImported: number;
  areasImported: number;
  pinsImported: number;
  viewsImported: number;
  membersImported: number;
  settingsApplied: boolean;
}

// ---------------------------------------------------------------------------
// Dry-run preview (no mutations)
// ---------------------------------------------------------------------------

export async function buildDryRunPreview(
  bins: DryRunBin[],
  importMode: 'merge' | 'replace',
) {
  const toCreate: { name: string; itemCount: number; tags: string[] }[] = [];
  const toSkip: { name: string; reason: string }[] = [];
  let totalItems = 0;

  // Batch-fetch existing IDs in one query when merge mode
  let existingIds: Set<string> | undefined;
  if (importMode === 'merge') {
    const ids = bins.map(b => b.id).filter((id): id is string => !!id);
    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const rows = await query<{ id: string }>(
        `SELECT id FROM bins WHERE id IN (${placeholders})`,
        ids,
      );
      existingIds = new Set(rows.rows.map(r => r.id));
    } else {
      existingIds = new Set();
    }
  }

  for (const bin of bins) {
    const items = bin.items || [];
    totalItems += items.length;

    if (existingIds && bin.id && existingIds.has(bin.id)) {
      toSkip.push({ name: bin.name, reason: 'already exists' });
      continue;
    }

    toCreate.push({ name: bin.name, itemCount: items.length, tags: bin.tags || [] });
  }

  return { preview: true as const, toCreate, toSkip, totalBins: bins.length, totalItems };
}

// ---------------------------------------------------------------------------
// Query-only area lookup (no creation) — used for CSV dry-run
// ---------------------------------------------------------------------------

export async function lookupArea(locationId: string, areaPath: string): Promise<string | null> {
  const parts = areaPath.trim().split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let parentId: string | null = null;
  let lastId: string | null = null;

  for (const part of parts) {
    const q = parentId === null
      ? 'SELECT id FROM areas WHERE location_id = $1 AND name = $2 AND parent_id IS NULL'
      : 'SELECT id FROM areas WHERE location_id = $1 AND name = $2 AND parent_id = $3';
    const params = parentId === null ? [locationId, part] : [locationId, part, parentId];
    const found = await query(q, params);
    if (found.rows.length > 0) {
      lastId = found.rows[0].id as string;
      parentId = lastId;
    } else {
      return null;
    }
  }

  return lastId;
}

// ---------------------------------------------------------------------------
// Unified full import transaction (JSON and ZIP)
// ---------------------------------------------------------------------------

export async function executeFullImportTransaction(params: FullImportParams): Promise<FullImportResult> {
  const {
    locationId, userId, isAdmin, importMode,
    bins, trashedBins, tagColors, customFieldDefinitions,
    locationSettings, areas, pinnedBins, savedViews, members,
  } = params;

  return withTransaction(async (tx: TxQueryFn) => {
    // 1. Replace-mode cleanup
    if (importMode === 'replace') {
      await replaceCleanup(locationId, tx);
    }

    // 2. Location settings (replace mode only, admin only)
    let settingsApplied = false;
    if (locationSettings && importMode === 'replace' && isAdmin) {
      await importLocationSettings(locationId, locationSettings, tx);
      settingsApplied = true;
    }

    // 3. Members (admin only)
    let membersImported = 0;
    if (members && Array.isArray(members) && isAdmin) {
      membersImported = await importMembers(locationId, members, tx);
    }

    // 4. Tag colors
    if (tagColors && Array.isArray(tagColors)) {
      await importTagColors(locationId, tagColors, tx);
    }

    // 5. Custom field definitions
    let fieldNameToId: Map<string, string> | undefined;
    if (customFieldDefinitions && Array.isArray(customFieldDefinitions)) {
      fieldNameToId = await resolveCustomFieldDefs(locationId, customFieldDefinitions, tx);
    }

    // 6. Areas (before bins so paths exist)
    let areasImported = 0;
    if (areas && Array.isArray(areas)) {
      areasImported = await importAreas(locationId, areas, userId, tx);
    }

    // Helper to import a single bin
    const oldToNewBinId = new Map<string, string>();

    async function importSingleBin(bin: ExportBin, opts?: { deletedAt?: string | null }): Promise<boolean> {
      if (importMode === 'merge') {
        const existing = await tx('SELECT id FROM bins WHERE id = $1', [bin.id]);
        if (existing.rows.length > 0) return false;
      }

      const areaId = await resolveArea(locationId, bin.location || '', userId, tx);
      let resolvedCustomFields = bin.customFields;
      if (resolvedCustomFields && fieldNameToId && fieldNameToId.size > 0) {
        resolvedCustomFields = mapCustomFieldsToIds(resolvedCustomFields, fieldNameToId);
      }

      const resolvedCreatedBy = await resolveCreatedBy(bin.createdBy, userId, tx);
      const binId = await insertBinWithShortCode('', locationId, {
        name: bin.name,
        notes: bin.notes || '',
        tags: bin.tags || [],
        icon: bin.icon || '',
        color: bin.color || '',
        cardStyle: bin.cardStyle,
        visibility: bin.visibility,
        customFields: resolvedCustomFields,
        shortCode: bin.shortCode,
        deletedAt: opts?.deletedAt,
        createdAt: bin.createdAt || new Date().toISOString(),
        updatedAt: bin.updatedAt || new Date().toISOString(),
      }, areaId, resolvedCreatedBy, tx);

      oldToNewBinId.set(bin.id, binId);
      await insertBinItems(binId, bin.items || [], tx);
      return true;
    }

    // 7. Active bins
    let binsImported = 0;
    let binsSkipped = 0;
    let photosImported = 0;

    for (const bin of bins) {
      if (await importSingleBin(bin)) {
        const newBinId = oldToNewBinId.get(bin.id)!;
        if (bin.photos && Array.isArray(bin.photos)) {
          photosImported += await importPhotos(newBinId, bin.photos, userId, tx);
        }
        binsImported++;
      } else {
        binsSkipped++;
      }
    }

    // 8. Trashed bins
    let trashedBinsImported = 0;
    if (trashedBins && Array.isArray(trashedBins)) {
      for (const bin of trashedBins) {
        if (await importSingleBin(bin, { deletedAt: bin.deletedAt })) {
          const newBinId = oldToNewBinId.get(bin.id)!;
          if (bin.photos && Array.isArray(bin.photos)) {
            photosImported += await importPhotos(newBinId, bin.photos, userId, tx);
          }
          trashedBinsImported++;
        }
      }
    }

    // 9. Pinned bins (after all bins are imported)
    let pinsImported = 0;
    if (pinnedBins && Array.isArray(pinnedBins)) {
      pinsImported = await importPinnedBins(pinnedBins, oldToNewBinId, tx);
    }

    // 10. Saved views
    let viewsImported = 0;
    if (savedViews && Array.isArray(savedViews)) {
      viewsImported = await importSavedViews(savedViews, tx);
    }

    return { binsImported, binsSkipped, trashedBinsImported, photosImported, areasImported, pinsImported, viewsImported, membersImported, settingsApplied };
  });
}
