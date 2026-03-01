import { useCallback, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/storageKeys';

export type ViewMode = 'grid' | 'compact' | 'table';

const VALID_MODES = new Set<ViewMode>(['grid', 'compact', 'table']);

function readStoredMode(): ViewMode {
  const raw = localStorage.getItem(STORAGE_KEYS.BIN_VIEW);
  return raw && VALID_MODES.has(raw as ViewMode) ? (raw as ViewMode) : 'grid';
}

export function useViewMode() {
  const [viewMode, _setViewMode] = useState<ViewMode>(readStoredMode);

  const setViewMode = useCallback((mode: ViewMode) => {
    localStorage.setItem(STORAGE_KEYS.BIN_VIEW, mode);
    _setViewMode(mode);
  }, []);

  return { viewMode, setViewMode };
}
