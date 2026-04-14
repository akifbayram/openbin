import { useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from '@/lib/storageKeys';

export type PageSizeValue = 10 | 25 | 50 | 100 | 'all';

export const ITEM_PAGE_SIZE_OPTIONS: PageSizeValue[] = [10, 25, 50, 100, 'all'];
const DEFAULT_PAGE_SIZE: PageSizeValue = 25;

function isPageSize(v: unknown): v is PageSizeValue {
  if (v === 'all') return true;
  return typeof v === 'number' && (ITEM_PAGE_SIZE_OPTIONS as readonly unknown[]).includes(v);
}

export function readItemPageSizeFromStorage(): PageSizeValue {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ITEM_PAGE_SIZE);
    if (raw == null) return DEFAULT_PAGE_SIZE;
    if (raw === 'all') return 'all';
    const n = Number(raw);
    if (isPageSize(n)) return n;
  } catch { /* ignore */ }
  return DEFAULT_PAGE_SIZE;
}

let currentPageSize: PageSizeValue = readItemPageSizeFromStorage();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): PageSizeValue {
  return currentPageSize;
}

export function setItemPageSize(size: PageSizeValue): void {
  if (size === currentPageSize) return;
  currentPageSize = size;
  try {
    localStorage.setItem(STORAGE_KEYS.ITEM_PAGE_SIZE, String(size));
  } catch { /* ignore */ }
  notify();
}

export function useItemPageSize() {
  const pageSize = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    pageSize,
    setPageSize: setItemPageSize,
    pageSizeOptions: ITEM_PAGE_SIZE_OPTIONS,
  };
}
