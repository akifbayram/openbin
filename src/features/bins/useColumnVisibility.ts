import { useState, useCallback, useMemo } from 'react';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import type { ViewMode } from './useViewMode';

export type FieldKey = 'icon' | 'area' | 'items' | 'tags' | 'updated' | 'created' | 'notes' | 'createdBy';

/** Which fields are toggleable per view mode */
const FIELD_APPLICABILITY: Record<ViewMode, Set<FieldKey>> = {
  grid: new Set(['icon', 'area', 'items', 'tags', 'notes']),
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
};

export const ALL_FIELDS: FieldKey[] = ['icon', 'area', 'items', 'tags', 'updated', 'created', 'notes', 'createdBy'];

function readStored(): Record<FieldKey, boolean> {
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

export function useColumnVisibility(viewMode: ViewMode) {
  const [visibility, setVisibility] = useState<Record<FieldKey, boolean>>(readStored);

  const toggleField = useCallback((field: FieldKey) => {
    setVisibility((prev) => {
      const next = { ...prev, [field]: !prev[field] };
      localStorage.setItem(STORAGE_KEYS.COLUMN_VISIBILITY, JSON.stringify(next));
      return next;
    });
  }, []);

  const applicableFields = useMemo(
    () => ALL_FIELDS.filter((f) => FIELD_APPLICABILITY[viewMode].has(f)),
    [viewMode],
  );

  const isVisible = useCallback(
    (field: FieldKey): boolean => {
      if (!FIELD_APPLICABILITY[viewMode].has(field)) return false;
      return visibility[field];
    },
    [viewMode, visibility],
  );

  return { visibility, toggleField, applicableFields, isVisible };
}
