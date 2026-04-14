import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PageSizeValue } from './useItemPageSize';

export interface ItemPaginationResult<T> {
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  totalCount: number;
  visibleItems: T[];
  rangeStart: number;
  rangeEnd: number;
  jumpToLastPage: () => void;
}

function computeTotalPages(count: number, pageSize: PageSizeValue): number {
  if (pageSize === 'all' || count === 0) return 1;
  return Math.max(1, Math.ceil(count / pageSize));
}

export function useItemPagination<T>(
  items: T[],
  pageSize: PageSizeValue,
  resetSignals: unknown[] = [],
): ItemPaginationResult<T> {
  const [pageInternal, setPageInternal] = useState(1);

  const totalCount = items.length;
  const totalPages = computeTotalPages(totalCount, pageSize);

  // Reset to page 1 when any reset signal changes. Serialize so the dep array length is stable,
  // which keeps the rules-of-hooks invariant without a lint suppression.
  const resetKey = resetSignals.map((v) => (v == null ? '\u0000' : String(v))).join('\u0001');
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is the only intended trigger
  useEffect(() => { setPageInternal(1); }, [resetKey]);

  // Render-time clamp: when the list shrinks past the current page, sync state in place so
  // the next render sees the corrected value without an extra effect-driven round-trip.
  if (pageInternal > totalPages) setPageInternal(totalPages);

  const page = Math.min(pageInternal, totalPages);

  const visibleItems = useMemo(() => {
    if (pageSize === 'all') return items;
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const rangeStart = totalCount === 0
    ? 0
    : pageSize === 'all'
      ? 1
      : (page - 1) * pageSize + 1;
  const rangeEnd = totalCount === 0
    ? 0
    : pageSize === 'all'
      ? totalCount
      : Math.min(page * pageSize, totalCount);

  const setPage = useCallback((p: number) => {
    if (!Number.isFinite(p)) return;
    setPageInternal(Math.max(1, Math.min(p, totalPages)));
  }, [totalPages]);

  const jumpToLastPage = useCallback(() => {
    setPageInternal(computeTotalPages(items.length, pageSize));
  }, [items.length, pageSize]);

  return {
    page,
    setPage,
    totalPages,
    totalCount,
    visibleItems,
    rangeStart,
    rangeEnd,
    jumpToLastPage,
  };
}
