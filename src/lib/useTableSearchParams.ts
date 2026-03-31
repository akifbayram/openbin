import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SortDirection } from '@/components/ui/sort-header';

/**
 * Generic URL-backed search/sort state for table pages.
 * Persists `q`, `sort`, and `sort_dir` in the URL.
 */
export function useTableSearchParams<C extends string>(defaultSort: C) {
  const [params, setParams] = useSearchParams();

  const search = params.get('q') ?? '';
  const sortColumn = (params.get('sort') ?? defaultSort) as C;
  const sortDirection = (params.get('sort_dir') ?? 'asc') as SortDirection;

  const setSearch = useCallback((value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('q', value);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, [setParams]);

  const setSort = useCallback((column: C, direction: SortDirection) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (column !== defaultSort) next.set('sort', column);
      else next.delete('sort');
      if (direction !== 'asc') next.set('sort_dir', direction);
      else next.delete('sort_dir');
      return next;
    }, { replace: true });
  }, [setParams, defaultSort]);

  return { search, sortColumn, sortDirection, setSearch, setSort };
}
