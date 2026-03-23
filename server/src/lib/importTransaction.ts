import { getDb, querySync } from '../db.js';
import {
  type ExportArea,
  type ExportBin,
  type ExportLocationSettings,
  type ExportMember,
  type ExportPinnedBin,
  type ExportSavedView,
  importAreasSync,
  importLocationSettingsSync,
  importMembersSync,
  importPhotosSync,
  importPinnedBinsSync,
  importSavedViewsSync,
  importTagColorsSync,
  insertBinItemsSync,
  insertBinWithShortCode,
  mapCustomFieldsToIds,
  replaceCleanupSync,
  resolveAreaSync,
  resolveCreatedBySync,
  resolveCustomFieldDefsSync,
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

export function buildDryRunPreview(
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
      const rows = querySync<{ id: string }>(
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

export function lookupAreaSync(locationId: string, areaPath: string): string | null {
  const parts = areaPath.trim().split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let parentId: string | null = null;
  let lastId: string | null = null;

  for (const part of parts) {
    const q = parentId === null
      ? 'SELECT id FROM areas WHERE location_id = $1 AND name = $2 AND parent_id IS NULL'
      : 'SELECT id FROM areas WHERE location_id = $1 AND name = $2 AND parent_id = $3';
    const params = parentId === null ? [locationId, part] : [locationId, part, parentId];
    const found = querySync(q, params);
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

export function executeFullImportTransaction(params: FullImportParams): FullImportResult {
  const {
    locationId, userId, isAdmin, importMode,
    bins, trashedBins, tagColors, customFieldDefinitions,
    locationSettings, areas, pinnedBins, savedViews, members,
  } = params;

  const doImport = getDb().transaction(() => {
    // 1. Replace-mode cleanup
    if (importMode === 'replace') {
      replaceCleanupSync(locationId);
    }

    // 2. Location settings (replace mode only, admin only)
    let settingsApplied = false;
    if (locationSettings && importMode === 'replace' && isAdmin) {
      importLocationSettingsSync(locationId, locationSettings);
      settingsApplied = true;
    }

    // 3. Members (admin only)
    let membersImported = 0;
    if (members && Array.isArray(members) && isAdmin) {
      membersImported = importMembersSync(locationId, members);
    }

    // 4. Tag colors
    if (tagColors && Array.isArray(tagColors)) {
      importTagColorsSync(locationId, tagColors);
    }

    // 5. Custom field definitions
    let fieldNameToId: Map<string, string> | undefined;
    if (customFieldDefinitions && Array.isArray(customFieldDefinitions)) {
      fieldNameToId = resolveCustomFieldDefsSync(locationId, customFieldDefinitions);
    }

    // 6. Areas (before bins so paths exist)
    let areasImported = 0;
    if (areas && Array.isArray(areas)) {
      areasImported = importAreasSync(locationId, areas, userId);
    }

    // Helper to import a single bin
    const oldToNewBinId = new Map<string, string>();

    function importSingleBin(bin: ExportBin, opts?: { deletedAt?: string | null }): boolean {
      if (importMode === 'merge') {
        const existing = querySync('SELECT id FROM bins WHERE id = $1', [bin.id]);
        if (existing.rows.length > 0) return false;
      }

      const areaId = resolveAreaSync(locationId, bin.location || '', userId);
      let resolvedCustomFields = bin.customFields;
      if (resolvedCustomFields && fieldNameToId && fieldNameToId.size > 0) {
        resolvedCustomFields = mapCustomFieldsToIds(resolvedCustomFields, fieldNameToId);
      }

      const resolvedCreatedBy = resolveCreatedBySync(bin.createdBy, userId);
      const binId = insertBinWithShortCode('', locationId, {
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
      }, areaId, resolvedCreatedBy);

      oldToNewBinId.set(bin.id, binId);
      insertBinItemsSync(binId, bin.items || []);
      return true;
    }

    // 7. Active bins
    let binsImported = 0;
    let binsSkipped = 0;
    let photosImported = 0;

    for (const bin of bins) {
      if (importSingleBin(bin)) {
        const newBinId = oldToNewBinId.get(bin.id)!;
        if (bin.photos && Array.isArray(bin.photos)) {
          photosImported += importPhotosSync(newBinId, bin.photos, userId);
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
        if (importSingleBin(bin, { deletedAt: bin.deletedAt })) {
          const newBinId = oldToNewBinId.get(bin.id)!;
          if (bin.photos && Array.isArray(bin.photos)) {
            photosImported += importPhotosSync(newBinId, bin.photos, userId);
          }
          trashedBinsImported++;
        }
      }
    }

    // 9. Pinned bins (after all bins are imported)
    let pinsImported = 0;
    if (pinnedBins && Array.isArray(pinnedBins)) {
      pinsImported = importPinnedBinsSync(pinnedBins, oldToNewBinId);
    }

    // 10. Saved views
    let viewsImported = 0;
    if (savedViews && Array.isArray(savedViews)) {
      viewsImported = importSavedViewsSync(savedViews);
    }

    return { binsImported, binsSkipped, trashedBinsImported, photosImported, areasImported, pinsImported, viewsImported, membersImported, settingsApplied };
  });

  return doImport();
}
