import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from '@/lib/useDebounce';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import { EMPTY_FILTERS, type SortOption, type BinFilters } from './useBins';
import type { SavedView } from '@/lib/savedViews';

const SORT_TO_API: Record<SortOption, string> = { updated: 'updated_at', created: 'created_at', name: 'name' };
const API_TO_SORT: Record<string, SortOption> = { updated_at: 'updated', created_at: 'created', name: 'name' };

function parseSortFromParams(params: URLSearchParams): SortOption {
  const raw = params.get('sort');
  if (raw && raw in API_TO_SORT) return API_TO_SORT[raw];
  const saved = localStorage.getItem(STORAGE_KEYS.BIN_SORT);
  return (saved as SortOption) || 'updated';
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

  const [filters, _setFilters] = useState<BinFilters>(() => parseFiltersFromParams(searchParams));

  const setSort = useCallback((value: SortOption | ((prev: SortOption) => SortOption)) => {
    _setSort((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      localStorage.setItem(STORAGE_KEYS.BIN_SORT, next);
      return next;
    });
  }, []);

  const setFilters = useCallback((value: BinFilters | ((prev: BinFilters) => BinFilters)) => {
    _setFilters(value);
  }, []);

  const clearAll = useCallback(() => {
    setSearch('');
    _setFilters(EMPTY_FILTERS);
  }, []);

  // Sync state → URL (replace, no history push)
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());

    const defaultSort = (localStorage.getItem(STORAGE_KEYS.BIN_SORT) as SortOption) || 'updated';
    if (sort !== defaultSort) params.set('sort', SORT_TO_API[sort]);

    if (filters.tags.length > 0) params.set('tags', filters.tags.join(','));
    if (filters.tags.length >= 2 && filters.tagMode === 'all') params.set('tag_mode', 'all');
    if (filters.colors.length > 0) params.set('colors', filters.colors.join(','));
    if (filters.areas.length > 0) params.set('areas', filters.areas.join(','));
    if (filters.hasItems) params.set('has_items', 'true');
    if (filters.hasNotes) params.set('has_notes', 'true');
    if (filters.needsOrganizing) params.set('needs_organizing', 'true');

    setSearchParams(params, { replace: true });
  }, [debouncedSearch, sort, filters, setSearchParams]);

  // Handle browser back/forward
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      setSearch(params.get('q') || '');
      _setSort(parseSortFromParams(params));
      _setFilters(parseFiltersFromParams(params));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return { search, setSearch, debouncedSearch, sort, setSort, filters, setFilters, clearAll };
}
