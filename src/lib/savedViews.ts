import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './api';
import type { SortOption, BinFilters } from '@/features/bins/useBins';
import type { ListResponse } from '@/types';

export interface SavedView {
  id: string;
  name: string;
  searchQuery: string;
  sort: SortOption;
  filters: BinFilters;
  createdAt: string;
}

interface ServerSavedView {
  id: string;
  name: string;
  search_query: string;
  sort: string;
  filters: string | BinFilters;
  created_at: string;
}

function toClient(sv: ServerSavedView): SavedView {
  return {
    id: sv.id,
    name: sv.name,
    searchQuery: sv.search_query,
    sort: sv.sort as SortOption,
    filters: typeof sv.filters === 'string' ? JSON.parse(sv.filters) : sv.filters,
    createdAt: sv.created_at,
  };
}

const SAVED_VIEWS_EVENT = 'saved-views-changed';

function notifySavedViewsChanged() {
  window.dispatchEvent(new Event(SAVED_VIEWS_EVENT));
}

export function useSavedViews() {
  const [views, setViews] = useState<SavedView[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    apiFetch<ListResponse<ServerSavedView>>('/api/saved-views')
      .then((data) => {
        setViews(data.results.map(toClient));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refresh();

    window.addEventListener(SAVED_VIEWS_EVENT, refresh);
    return () => window.removeEventListener(SAVED_VIEWS_EVENT, refresh);
  }, [refresh]);

  return { views, isLoading, refresh };
}

export async function saveView(view: { name: string; searchQuery: string; sort: SortOption; filters: BinFilters }): Promise<SavedView> {
  const sv = await apiFetch<ServerSavedView>('/api/saved-views', {
    method: 'POST',
    body: {
      name: view.name,
      search_query: view.searchQuery,
      sort: view.sort,
      filters: view.filters,
    },
  });
  notifySavedViewsChanged();
  return toClient(sv);
}

export async function deleteView(viewId: string): Promise<void> {
  await apiFetch(`/api/saved-views/${viewId}`, { method: 'DELETE' });
  notifySavedViewsChanged();
}

export async function renameView(viewId: string, newName: string): Promise<void> {
  await apiFetch(`/api/saved-views/${viewId}`, { method: 'PUT', body: { name: newName } });
  notifySavedViewsChanged();
}
