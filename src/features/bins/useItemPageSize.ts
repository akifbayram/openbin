import { useCallback, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/storageKeys';

export type PageSizeValue = 10 | 25 | 50 | 100 | 'all';

const PAGE_SIZE_OPTIONS: PageSizeValue[] = [10, 25, 50, 100, 'all'];
const DEFAULT_PAGE_SIZE: PageSizeValue = 25;

function isPageSize(v: unknown): v is PageSizeValue {
  if (v === 'all') return true;
  return typeof v === 'number' && (PAGE_SIZE_OPTIONS as readonly unknown[]).includes(v);
}

function readPageSize(): PageSizeValue {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ITEM_PAGE_SIZE);
    if (raw == null) return DEFAULT_PAGE_SIZE;
    if (raw === 'all') return 'all';
    const n = Number(raw);
    if (isPageSize(n)) return n;
  } catch { /* ignore */ }
  return DEFAULT_PAGE_SIZE;
}

export function useItemPageSize() {
  const [pageSize, setPageSizeState] = useState<PageSizeValue>(readPageSize);

  const setPageSize = useCallback((size: PageSizeValue) => {
    setPageSizeState(size);
    try {
      localStorage.setItem(STORAGE_KEYS.ITEM_PAGE_SIZE, String(size));
    } catch { /* ignore */ }
  }, []);

  return { pageSize, setPageSize, pageSizeOptions: PAGE_SIZE_OPTIONS };
}
