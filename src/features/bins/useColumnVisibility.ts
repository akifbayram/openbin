import { useCallback, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import type { CustomField } from '@/types';
import type { ViewMode } from './useViewMode';

export type FieldKey = 'icon' | 'area' | 'items' | 'tags' | 'updated' | 'created' | 'notes' | 'createdBy' | 'customFields';

/** Static fields applicable per view mode (customFields only for grid/compact) */
const FIELD_APPLICABILITY: Record<ViewMode, Set<FieldKey>> = {
  grid: new Set(['icon', 'area', 'items', 'tags', 'notes', 'customFields']),
  compact: new Set(['icon', 'area']),
  table: new Set(['icon', 'area', 'items', 'tags', 'updated', 'created', 'notes', 'createdBy']),
};

const DEFAULT_VISIBILITY: Record<FieldKey, boolean> = {
  icon: true,
  area: true,
  items: true,
  tags: true,
  updated: true,
  created: false,
  notes: false,
  createdBy: false,
  customFields: false,
};

export const FIELD_LABELS: Record<FieldKey, string> = {
  icon: 'Icon',
  area: 'Area',
  items: 'Items',
  tags: 'Tags',
  updated: 'Updated',
  created: 'Created',
  notes: 'Notes',
  createdBy: 'Created By',
  customFields: 'Custom Fields',
};

export const ALL_FIELDS: FieldKey[] = ['icon', 'area', 'items', 'tags', 'updated', 'created', 'notes', 'createdBy', 'customFields'];

/** Static fields for table view (no customFields — those are dynamic cf_ keys) */
const TABLE_STATIC_FIELDS: FieldKey[] = ['icon', 'area', 'items', 'tags', 'updated', 'created', 'notes', 'createdBy'];

function readStored(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COLUMN_VISIBILITY);
    if (!raw) return { ...DEFAULT_VISIBILITY };
    const parsed = JSON.parse(raw);
    // Merge with defaults so new fields get default values
    return { ...DEFAULT_VISIBILITY, ...parsed };
  } catch {
    return { ...DEFAULT_VISIBILITY };
  }
}

export function useColumnVisibility(viewMode: ViewMode, customFields?: CustomField[]) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(readStored);

  const toggleField = useCallback((field: string) => {
    setVisibility((prev) => {
      // cf_* keys default to true (shown); static keys use their default
      const current = prev[field] ?? (field.startsWith('cf_') ? true : DEFAULT_VISIBILITY[field as FieldKey] ?? false);
      const next = { ...prev, [field]: !current };
      localStorage.setItem(STORAGE_KEYS.COLUMN_VISIBILITY, JSON.stringify(next));
      return next;
    });
  }, []);

  const applicableFields = useMemo(() => {
    if (viewMode === 'table') {
      const staticFields = TABLE_STATIC_FIELDS.filter((f) => FIELD_APPLICABILITY.table.has(f));
      if (customFields && customFields.length > 0) {
        const sorted = [...customFields].sort((a, b) => a.position - b.position);
        const cfKeys = sorted.map((f) => `cf_${f.id}`);
        return [...staticFields, ...cfKeys];
      }
      return staticFields;
    }
    return ALL_FIELDS.filter((f) => FIELD_APPLICABILITY[viewMode].has(f));
  }, [viewMode, customFields]);

  const isVisible = useCallback(
    (field: string): boolean => {
      // Dynamic custom field keys — default to true if not explicitly set
      if (field.startsWith('cf_')) {
        return visibility[field] ?? true;
      }
      if (!FIELD_APPLICABILITY[viewMode].has(field as FieldKey)) return false;
      return visibility[field] ?? DEFAULT_VISIBILITY[field as FieldKey] ?? false;
    },
    [viewMode, visibility],
  );

  return { visibility, toggleField, applicableFields, isVisible };
}
