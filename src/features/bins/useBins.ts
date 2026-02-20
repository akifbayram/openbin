import { useMemo, useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify, useRefreshOn } from '@/lib/eventBus';
import { useListData } from '@/lib/useListData';
import { usePaginatedList } from '@/lib/usePaginatedList';
import type { Bin, BinItem, BinVisibility } from '@/types';

/** Notify all useBinList / useBin instances to refetch */
export const notifyBinsChanged = () => notify(Events.BINS);

export type SortOption = 'updated' | 'created' | 'name';

export interface BinFilters {
  tags: string[];
  tagMode: 'any' | 'all';
  colors: string[];
  areas: string[];
  hasItems: boolean;
  hasNotes: boolean;
  needsOrganizing?: boolean;
}

export const EMPTY_FILTERS: BinFilters = {
  tags: [], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false,
};

export function countActiveFilters(f: BinFilters): number {
  let n = 0;
  if (f.tags.length) n++;
  if (f.colors.length) n++;
  if (f.areas.length) n++;
  if (f.hasItems) n++;
  if (f.hasNotes) n++;
  return n;
}

export function useBinList(searchQuery?: string, sort: SortOption = 'updated', filters?: BinFilters) {
  const { activeLocationId, token } = useAuth();
  const { data: rawBins, isLoading, refresh } = useListData<Bin>(
    token && activeLocationId
      ? `/api/bins?location_id=${encodeURIComponent(activeLocationId)}`
      : null,
    [Events.BINS],
  );

  const bins = useMemo(() => {
    let filtered = [...rawBins];

    if (searchQuery?.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (bin) =>
          bin.name.toLowerCase().includes(q) ||
          (bin.area_name ?? '').toLowerCase().includes(q) ||
          (Array.isArray(bin.items) ? bin.items : []).some((item) => item.name.toLowerCase().includes(q)) ||
          bin.notes.toLowerCase().includes(q) ||
          (Array.isArray(bin.tags) ? bin.tags : []).some((tag: string) => tag.toLowerCase().includes(q)) ||
          (bin.short_code && bin.short_code.toLowerCase().includes(q))
      );
    }

    if (filters) {
      if (filters.tags.length > 0) {
        const selectedTags = filters.tags;
        filtered = filtered.filter((bin) => {
          const binTags = Array.isArray(bin.tags) ? bin.tags : [];
          if (filters.tagMode === 'all') {
            return selectedTags.every((t) => binTags.includes(t));
          }
          return selectedTags.some((t) => binTags.includes(t));
        });
      }
      if (filters.colors.length > 0) {
        const colorSet = new Set(filters.colors);
        filtered = filtered.filter((bin) => colorSet.has(bin.color));
      }
      if (filters.areas.length > 0) {
        const areaSet = new Set(filters.areas);
        filtered = filtered.filter((bin) =>
          bin.area_id ? areaSet.has(bin.area_id) : areaSet.has('__unassigned__')
        );
      }
      if (filters.hasItems) {
        filtered = filtered.filter((bin) => Array.isArray(bin.items) && bin.items.length > 0);
      }
      if (filters.hasNotes) {
        filtered = filtered.filter((bin) => typeof bin.notes === 'string' && bin.notes.trim().length > 0);
      }
      if (filters.needsOrganizing) {
        filtered = filtered.filter(
          (bin) =>
            (!Array.isArray(bin.tags) || bin.tags.length === 0) &&
            !bin.area_id &&
            (!Array.isArray(bin.items) || bin.items.length === 0)
        );
      }
    }

    if (sort === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'created') {
      filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }

    return filtered;
  }, [rawBins, searchQuery, sort, filters]);

  return { bins, isLoading, refresh };
}

function buildFilterParams(
  searchQuery: string | undefined,
  sort: SortOption,
  filters: BinFilters | undefined,
): string {
  const p = new URLSearchParams();
  if (searchQuery?.trim()) p.set('q', searchQuery.trim());

  const sortMap: Record<SortOption, string> = { updated: 'updated_at', created: 'created_at', name: 'name' };
  p.set('sort', sortMap[sort]);
  p.set('sort_dir', sort === 'name' ? 'asc' : 'desc');

  if (filters) {
    if (filters.tags.length > 0) {
      p.set('tags', filters.tags.join(','));
      if (filters.tagMode === 'all') p.set('tag_mode', 'all');
    }
    if (filters.colors.length > 0) p.set('colors', filters.colors.join(','));
    if (filters.areas.length > 0) p.set('areas', filters.areas.join(','));
    if (filters.hasItems) p.set('has_items', 'true');
    if (filters.hasNotes) p.set('has_notes', 'true');
    if (filters.needsOrganizing) p.set('needs_organizing', 'true');
  }

  const qs = p.toString();
  return qs ? `&${qs}` : '';
}

export function usePaginatedBinList(
  searchQuery?: string,
  sort: SortOption = 'updated',
  filters?: BinFilters,
  pageSize = 40,
) {
  const { activeLocationId, token } = useAuth();

  const basePath = token && activeLocationId
    ? `/api/bins?location_id=${encodeURIComponent(activeLocationId)}${buildFilterParams(searchQuery, sort, filters)}`
    : null;

  const { items, totalCount, isLoading, isLoadingMore, hasMore, error, loadMore } =
    usePaginatedList<Bin>(basePath, [Events.BINS], pageSize);

  return { bins: items, totalCount, isLoading, isLoadingMore, hasMore, error, loadMore };
}

export function useBin(id: string | undefined) {
  const { token } = useAuth();
  const [bin, setBin] = useState<Bin | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const refreshCounter = useRefreshOn(Events.BINS);
  const loadedIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!id || !token) {
      setBin(undefined);
      setIsLoading(false);
      loadedIdRef.current = undefined;
      return;
    }

    let cancelled = false;
    // Only show loading skeleton on first load for this bin ID.
    // On background refreshes (e.g. after item delete), keep showing current data.
    if (loadedIdRef.current !== id) {
      setIsLoading(true);
    }

    apiFetch<Bin>(`/api/bins/${id}`)
      .then((data) => {
        if (!cancelled) {
          setBin(data);
          loadedIdRef.current = id;
        }
      })
      .catch(() => {
        if (!cancelled) setBin(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, token, refreshCounter]);

  return { bin: bin ?? undefined, isLoading };
}

export interface AddBinOptions {
  name: string;
  locationId: string;
  items?: string[];
  notes?: string;
  tags?: string[];
  areaId?: string | null;
  icon?: string;
  color?: string;
  visibility?: BinVisibility;
}

export async function addBin(options: AddBinOptions): Promise<string> {
  const result = await apiFetch<{ id: string }>('/api/bins', {
    method: 'POST',
    body: {
      locationId: options.locationId,
      name: options.name,
      areaId: options.areaId ?? null,
      items: options.items ?? [],
      notes: options.notes ?? '',
      tags: options.tags ?? [],
      icon: options.icon ?? '',
      color: options.color ?? '',
      visibility: options.visibility ?? 'location',
    },
  });
  notifyBinsChanged();
  return result.id;
}

export async function updateBin(
  id: string,
  changes: Partial<Pick<Bin, 'name' | 'notes' | 'tags' | 'icon' | 'color' | 'visibility'>> & { areaId?: string | null; items?: string[] }
): Promise<void> {
  await apiFetch(`/api/bins/${id}`, {
    method: 'PUT',
    body: changes,
  });
  notifyBinsChanged();
}

export async function addItemsToBin(binId: string, items: string[]): Promise<BinItem[]> {
  const result = await apiFetch<{ items: BinItem[] }>(`/api/bins/${binId}/items`, {
    method: 'POST',
    body: { items },
  });
  notifyBinsChanged();
  return result.items;
}

export async function removeItemFromBin(binId: string, itemId: string): Promise<void> {
  await apiFetch(`/api/bins/${binId}/items/${itemId}`, { method: 'DELETE' });
  notifyBinsChanged();
}

export async function renameItem(binId: string, itemId: string, name: string): Promise<void> {
  await apiFetch(`/api/bins/${binId}/items/${itemId}`, {
    method: 'PUT',
    body: { name },
  });
  notifyBinsChanged();
}

export async function reorderItems(binId: string, itemIds: string[]): Promise<void> {
  await apiFetch(`/api/bins/${binId}/items/reorder`, {
    method: 'PUT',
    body: { item_ids: itemIds },
  });
  notifyBinsChanged();
}

export async function deleteBin(id: string): Promise<Bin> {
  const bin = await apiFetch<Bin>(`/api/bins/${id}`, {
    method: 'DELETE',
  });
  notifyBinsChanged();
  return bin;
}

export async function restoreBin(bin: Bin): Promise<void> {
  await apiFetch(`/api/bins/${bin.id}/restore`, { method: 'POST' });
  notifyBinsChanged();
}

export function useAllTags(): string[] {
  const { bins } = useBinList();
  return useMemo(() => {
    const tagSet = new Set<string>();
    for (const bin of bins) {
      if (Array.isArray(bin.tags)) {
        for (const tag of bin.tags) tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
  }, [bins]);
}

export async function moveBin(id: string, locationId: string): Promise<void> {
  await apiFetch(`/api/bins/${id}/move`, { method: 'POST', body: { locationId } });
  notifyBinsChanged();
}

export async function lookupBinByCode(shortCode: string): Promise<Bin> {
  return apiFetch<Bin>(`/api/bins/lookup/${encodeURIComponent(shortCode)}`);
}

export function useTrashBins() {
  const { activeLocationId, token } = useAuth();
  const { data: bins, isLoading, refresh } = useListData<Bin>(
    token && activeLocationId
      ? `/api/bins/trash?location_id=${encodeURIComponent(activeLocationId)}`
      : null,
    [Events.BINS],
  );
  return { bins, isLoading, refresh };
}

export async function restoreBinFromTrash(binId: string): Promise<Bin> {
  const bin = await apiFetch<Bin>(`/api/bins/${binId}/restore`, { method: 'POST' });
  notifyBinsChanged();
  return bin;
}

export async function permanentDeleteBin(binId: string): Promise<void> {
  await apiFetch(`/api/bins/${binId}/permanent`, { method: 'DELETE' });
  notifyBinsChanged();
}
