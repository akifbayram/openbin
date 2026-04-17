import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { EventName } from '@/lib/eventBus';
import { notify, useRefreshOn } from '@/lib/eventBus';
import { getErrorMessage } from '@/lib/utils';
import type { ListResponse } from '@/types';

/**
 * Consolidated list-fetching hooks.
 *
 * Three modes sharing the same fetch-with-generation primitive:
 *  - `useListData`     — simple list, transform optional
 *  - `usePaginatedList`— offset-based, loadMore appends
 *  - `usePagedList`    — page-based, each page replaces items
 *
 * All three: watch `@/lib/eventBus` events, skip on null path,
 * abort stale responses via generation counter, expose `error`+`isLoading`.
 */

/** Append `limit`/`offset` to a path, respecting existing query string. */
function withRange(path: string, limit: number, offset: number): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}limit=${limit}&offset=${offset}`;
}

// ---------------------------------------------------------------------------
// useListData — simple list with optional transform
// ---------------------------------------------------------------------------

export interface ListDataResult<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches a list from `path` and extracts `results`. Listens for refresh events.
 * Shows loading skeleton only on initial load, not background refreshes.
 *
 * @param path  API path to fetch, or null to skip.
 * @param events  Event names that trigger a refetch.
 * @param transform  Optional transform applied to `response.results`.
 */
export function useListData<T, R = T>(
  path: string | null,
  events: EventName[],
  transform?: (results: R[]) => T[],
): ListDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);
  const refreshCounter = useRefreshOn(...events);

  useEffect(() => {
    if (!path) {
      setData([]);
      setIsLoading(false);
      setError(null);
      hasData.current = false;
      return;
    }

    let cancelled = false;
    if (!hasData.current) setIsLoading(true);
    setError(null);

    apiFetch<ListResponse<R>>(path)
      .then((resp) => {
        if (cancelled) return;
        setData(transform ? transform(resp.results) : (resp.results as unknown as T[]));
        hasData.current = true;
      })
      .catch((err) => {
        if (cancelled) return;
        setData([]);
        setError(getErrorMessage(err, 'Failed to load'));
        hasData.current = false;
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, refreshCounter]);

  const refresh = useCallback(() => {
    for (const e of events) notify(e);
  }, [events.join(',')]);

  return { data, isLoading, error, refresh };
}

// ---------------------------------------------------------------------------
// usePaginatedList — offset-based, loadMore appends
// ---------------------------------------------------------------------------

export interface PaginatedListResult<T> {
  items: T[];
  totalCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
}

/**
 * Offset-based paginated fetching. Reset to offset 0 on mount, basePath
 * change, or event bus refresh. `loadMore()` appends the next page.
 */
export function usePaginatedList<T>(
  basePath: string | null,
  events: EventName[],
  pageSize = 40,
): PaginatedListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const generationRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const isLoadingMoreRef = useRef(false);
  const refreshCounter = useRefreshOn(...events);

  useEffect(() => {
    const generation = ++generationRef.current;
    offsetRef.current = 0;
    isRefreshingRef.current = true;

    if (!basePath) {
      setItems([]);
      setTotalCount(0);
      setIsLoading(false);
      setError(null);
      isRefreshingRef.current = false;
      return;
    }

    setIsLoading(true);
    setError(null);

    apiFetch<ListResponse<T>>(withRange(basePath, pageSize, 0))
      .then((resp) => {
        if (generation !== generationRef.current) return;
        setItems(resp.results);
        setTotalCount(resp.count);
        offsetRef.current = resp.results.length;
      })
      .catch((err) => {
        if (generation !== generationRef.current) return;
        setItems([]);
        setTotalCount(0);
        setError(getErrorMessage(err, 'Failed to load'));
      })
      .finally(() => {
        if (generation !== generationRef.current) return;
        isRefreshingRef.current = false;
        setIsLoading(false);
      });
  }, [basePath, pageSize, refreshCounter]);

  const hasMore = offsetRef.current < totalCount;

  const loadMore = useCallback(() => {
    if (!basePath || isLoadingMoreRef.current || !hasMore || isRefreshingRef.current) return;

    isLoadingMoreRef.current = true;
    const generation = generationRef.current;
    const currentOffset = offsetRef.current;
    setIsLoadingMore(true);

    apiFetch<ListResponse<T>>(withRange(basePath, pageSize, currentOffset))
      .then((resp) => {
        if (generation !== generationRef.current) return;
        setItems((prev) => [...prev, ...resp.results]);
        setTotalCount(resp.count);
        offsetRef.current = currentOffset + resp.results.length;
      })
      .catch((err) => {
        if (generation !== generationRef.current) return;
        setError(getErrorMessage(err, 'Failed to load more'));
      })
      .finally(() => {
        isLoadingMoreRef.current = false;
        if (generation !== generationRef.current) return;
        setIsLoadingMore(false);
      });
  }, [basePath, pageSize, hasMore]);

  return { items, totalCount, isLoading, isLoadingMore, hasMore, error, loadMore };
}

// ---------------------------------------------------------------------------
// usePagedList — page-based, each page replaces items
// ---------------------------------------------------------------------------

export interface PagedListResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  goToPage: (page: number) => void;
}

/**
 * Page-based fetching. Each page fetch replaces items (no accumulation).
 * Resets to page 1 when basePath changes (search/sort/filter).
 * Event bus refresh reloads current page.
 */
export function usePagedList<T>(
  basePath: string | null,
  events: EventName[],
  page: number,
  pageSize: number,
  onPageChange: (page: number) => void,
): PagedListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const refreshCounter = useRefreshOn(...events);

  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));

  useEffect(() => {
    const generation = ++generationRef.current;

    if (!basePath) {
      setItems([]);
      setTotalCount(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const offset = (page - 1) * safePageSize;

    apiFetch<ListResponse<T>>(withRange(basePath, safePageSize, offset))
      .then((resp) => {
        if (generation !== generationRef.current) return;
        setItems(resp.results);
        setTotalCount(resp.count);
      })
      .catch((err) => {
        if (generation !== generationRef.current) return;
        setItems([]);
        setTotalCount(0);
        setError(getErrorMessage(err, 'Failed to load'));
      })
      .finally(() => {
        if (generation !== generationRef.current) return;
        setIsLoading(false);
      });
  }, [basePath, page, safePageSize, refreshCounter]);

  const goToPage = useCallback(
    (p: number) => {
      const clamped = Math.max(1, Math.min(p, totalPages));
      onPageChange(clamped);
    },
    [totalPages, onPageChange],
  );

  return { items, totalCount, page, totalPages, isLoading, error, goToPage };
}
