import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SortDirection } from '@/components/ui/sort-header';
import { useDebounce } from '@/lib/useDebounce';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import { EMPTY_FILTERS, type SortOption, type BinFilters } from './useBins';
import type { SavedView } from '@/lib/savedViews';

const SORT_TO_API: Record<SortOption, string> = { updated: 'updated_at', created: 'created_at', name: 'name', area: 'area' };
const API_TO_SORT: Record<string, SortOption> = { updated_at: 'updated', created_at: 'created', name: 'name', area: 'area' };

export const DEFAULT_BIN_SORT_DIRS: Record<SortOption, SortDirection> = {
  name: 'asc',
  updated: 'desc',
  created: 'desc',
  area: 'asc',
};

function parseSortFromParams(params: URLSearchParams): SortOption {
  const raw = params.get('sort');
  if (raw && raw in API_TO_SORT) return API_TO_SORT[raw];
  const saved = localStorage.getItem(STORAGE_KEYS.BIN_SORT);
  return (saved as SortOption) || 'updated';
}

function parseSortDirFromParams(params: URLSearchParams, sort: SortOption): SortDirection {
  const raw = params.get('sort_dir');
  if (raw === 'asc' || raw === 'desc') return raw;
  return DEFAULT_BIN_SORT_DIRS[sort];
}

function parseFiltersFromParams(params: URLSearchParams): BinFilters {
  const tagsRaw = params.get('tags');
  const colorsRaw = params.get('colors');
  const areasRaw = params.get('areas');
  return {
    tags: tagsRaw ? tagsRaw.split(',').filter(Boolean) : [],
    tagMode: params.get('tag_mode') === 'all' ? 'all' : 'any',
    colors: colorsRaw ? colorsRaw.split(',').filter(Boolean) : [],
    areas: areasRaw ? areasRaw.split(',').filter(Boolean) : [],
    hasItems: params.get('has_items') === 'true',
    hasNotes: params.get('has_notes') === 'true',
    needsOrganizing: params.get('needs_organizing') === 'true' || undefined,
  };
}

function parsePageFromParams(params: URLSearchParams): number {
  const raw = params.get('page');
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) || n < 1 ? 1 : n;
}

export function buildViewSearchParams(view: SavedView): string {
  const params = new URLSearchParams();
  if (view.searchQuery.trim()) params.set('q', view.searchQuery.trim());
  if (view.sort !== 'updated') params.set('sort', SORT_TO_API[view.sort]);
  const f = view.filters;
  if (f.tags.length > 0) params.set('tags', f.tags.join(','));
  if (f.tags.length >= 2 && f.tagMode === 'all') params.set('tag_mode', 'all');
  if (f.colors.length > 0) params.set('colors', f.colors.join(','));
  if (f.areas.length > 0) params.set('areas', f.areas.join(','));
  if (f.hasItems) params.set('has_items', 'true');
  if (f.hasNotes) params.set('has_notes', 'true');
  if (f.needsOrganizing) params.set('needs_organizing', 'true');
  return params.toString();
}

export function useBinSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const debouncedSearch = useDebounce(search, 250);

  const [sort, _setSort] = useState<SortOption>(() => parseSortFromParams(searchParams));
  const [sortDir, _setSortDir] = useState<SortDirection>(() => parseSortDirFromParams(searchParams, parseSortFromParams(searchParams)));

  const [filters, _setFilters] = useState<BinFilters>(() => parseFiltersFromParams(searchParams));

  const [page, _setPage] = useState(() => parsePageFromParams(searchParams));

  // Track previous search/sort/filters to reset page on change
  const prevDepsRef = useRef({ debouncedSearch, sort, sortDir, filters });

  useEffect(() => {
    const prev = prevDepsRef.current;
    const changed =
      prev.debouncedSearch !== debouncedSearch ||
      prev.sort !== sort ||
      prev.sortDir !== sortDir ||
      prev.filters !== filters;

    prevDepsRef.current = { debouncedSearch, sort, sortDir, filters };

    if (changed) {
      _setPage(1);
    }
  }, [debouncedSearch, sort, sortDir, filters]);

  const setSort = useCallback((value: SortOption | ((prev: SortOption) => SortOption)) => {
    _setSort((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      localStorage.setItem(STORAGE_KEYS.BIN_SORT, next);
      if (next !== prev) {
        _setSortDir(DEFAULT_BIN_SORT_DIRS[next]);
      }
      return next;
    });
  }, []);

  const setSortDir = useCallback((value: SortDirection) => {
    _setSortDir(value);
  }, []);

  const setFilters = useCallback((value: BinFilters | ((prev: BinFilters) => BinFilters)) => {
    _setFilters(value);
  }, []);

  const setPage = useCallback((value: number) => {
    _setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const clearAll = useCallback(() => {
    setSearch('');
    _setFilters(EMPTY_FILTERS);
    _setPage(1);
  }, []);

  // Sync state → URL (replace, no history push)
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());

    const defaultSort = (localStorage.getItem(STORAGE_KEYS.BIN_SORT) as SortOption) || 'updated';
    if (sort !== defaultSort) params.set('sort', SORT_TO_API[sort]);
    if (sortDir !== DEFAULT_BIN_SORT_DIRS[sort]) params.set('sort_dir', sortDir);

    if (filters.tags.length > 0) params.set('tags', filters.tags.join(','));
    if (filters.tags.length >= 2 && filters.tagMode === 'all') params.set('tag_mode', 'all');
    if (filters.colors.length > 0) params.set('colors', filters.colors.join(','));
    if (filters.areas.length > 0) params.set('areas', filters.areas.join(','));
    if (filters.hasItems) params.set('has_items', 'true');
    if (filters.hasNotes) params.set('has_notes', 'true');
    if (filters.needsOrganizing) params.set('needs_organizing', 'true');

    if (page > 1) params.set('page', String(page));

    setSearchParams(params, { replace: true });
  }, [debouncedSearch, sort, sortDir, filters, page, setSearchParams]);

  // Handle browser back/forward
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const restoredSort = parseSortFromParams(params);
      setSearch(params.get('q') || '');
      _setSort(restoredSort);
      _setSortDir(parseSortDirFromParams(params, restoredSort));
      _setFilters(parseFiltersFromParams(params));
      _setPage(parsePageFromParams(params));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return { search, setSearch, debouncedSearch, sort, setSort, sortDir, setSortDir, filters, setFilters, page, setPage, clearAll };
}
