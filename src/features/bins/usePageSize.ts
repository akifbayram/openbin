import { useState, useCallback } from 'react';
import { STORAGE_KEYS } from '@/lib/storageKeys';

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;
const DEFAULT_PAGE_SIZE = 24;

function readPageSize(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BIN_PAGE_SIZE);
    if (raw) {
      const n = Number(raw);
      if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return n;
    }
  } catch { /* ignore */ }
  return DEFAULT_PAGE_SIZE;
}

export function usePageSize(onPageReset?: () => void) {
  const [pageSize, setPageSizeState] = useState(readPageSize);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    try { localStorage.setItem(STORAGE_KEYS.BIN_PAGE_SIZE, String(size)); } catch { /* ignore */ }
    onPageReset?.();
  }, [onPageReset]);

  return { pageSize, setPageSize, pageSizeOptions: PAGE_SIZE_OPTIONS as unknown as number[] };
}
