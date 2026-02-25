import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useRefreshOn } from '@/lib/eventBus';
import type { EventName } from '@/lib/eventBus';
import type { ListResponse } from '@/types';

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  goToPage: (page: number) => void;
}

/**
 * Generic hook for page-based fetching.
 * Each page fetch replaces items (no accumulation).
 * Resets to page 1 when basePath changes (search/sort/filter).
 * Event bus refresh reloads current page.
 */
export function usePagedList<T>(
  basePath: string | null,
  events: EventName[],
  page: number,
  pageSize: number,
  onPageChange: (page: number) => void,
): PagedResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const refreshCounter = useRefreshOn(...events);

  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));

  // Fetch page data when basePath, page, or refresh changes
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
    const sep = basePath.includes('?') ? '&' : '?';
    const url = `${basePath}${sep}limit=${safePageSize}&offset=${offset}`;

    apiFetch<ListResponse<T>>(url)
      .then((resp) => {
        if (generation !== generationRef.current) return;
        setItems(resp.results);
        setTotalCount(resp.count);
      })
      .catch((err) => {
        if (generation !== generationRef.current) return;
        setItems([]);
        setTotalCount(0);
        setError(err instanceof Error ? err.message : 'Failed to load');
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
