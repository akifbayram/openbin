import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useRefreshOn } from '@/lib/eventBus';
import type { EventName } from '@/lib/eventBus';
import type { ListResponse } from '@/types';

interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
}

/**
 * Generic hook for offset-based paginated fetching.
 * On mount, basePath change, or event bus refresh → resets to offset 0.
 * `loadMore()` fetches the next page and appends.
 */
export function usePaginatedList<T>(
  basePath: string | null,
  events: EventName[],
  pageSize = 40,
): PaginatedResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const generationRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const refreshCounter = useRefreshOn(...events);

  // Reset and fetch first page when basePath or refresh changes
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

    const sep = basePath.includes('?') ? '&' : '?';
    const url = `${basePath}${sep}limit=${pageSize}&offset=0`;

    apiFetch<ListResponse<T>>(url)
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
        setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (generation !== generationRef.current) return;
        isRefreshingRef.current = false;
        setIsLoading(false);
      });
  }, [basePath, pageSize, refreshCounter]);

  const hasMore = offsetRef.current < totalCount;

  const loadMore = useCallback(() => {
    if (!basePath || isLoadingMore || !hasMore || isRefreshingRef.current) return;

    const generation = generationRef.current;
    const currentOffset = offsetRef.current;
    setIsLoadingMore(true);

    const sep = basePath.includes('?') ? '&' : '?';
    const url = `${basePath}${sep}limit=${pageSize}&offset=${currentOffset}`;

    apiFetch<ListResponse<T>>(url)
      .then((resp) => {
        if (generation !== generationRef.current) return;
        setItems((prev) => [...prev, ...resp.results]);
        setTotalCount(resp.count);
        offsetRef.current = currentOffset + resp.results.length;
      })
      .catch((err) => {
        if (generation !== generationRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load more');
      })
      .finally(() => {
        if (generation !== generationRef.current) return;
        setIsLoadingMore(false);
      });
  }, [basePath, pageSize, isLoadingMore, hasMore]);

  return { items, totalCount, isLoading, isLoadingMore, hasMore, error, loadMore };
}
