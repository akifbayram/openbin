import { useMemo, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Bin } from '@/types';

const BINS_CHANGED_EVENT = 'bins-changed';

/** Notify all useBinList / useBin instances to refetch */
export function notifyBinsChanged() {
  window.dispatchEvent(new Event(BINS_CHANGED_EVENT));
}

export type SortOption = 'updated' | 'created' | 'name' | 'area';

export interface BinFilters {
  tags: string[];
  tagMode: 'any' | 'all';
  colors: string[];
  areas: string[];
  hasItems: boolean;
  hasNotes: boolean;
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
  const [rawBins, setRawBins] = useState<Bin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!token || !activeLocationId) {
      setRawBins([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<Bin[]>(`/api/bins?location_id=${encodeURIComponent(activeLocationId)}`)
      .then((data) => {
        if (!cancelled) setRawBins(data);
      })
      .catch(() => {
        if (!cancelled) setRawBins([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, activeLocationId, refreshCounter]);

  // Listen for bins-changed events
  useEffect(() => {
    const handler = () => setRefreshCounter((c) => c + 1);
    window.addEventListener(BINS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(BINS_CHANGED_EVENT, handler);
  }, []);

  const bins = useMemo(() => {
    let filtered = [...rawBins];

    if (searchQuery?.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (bin) =>
          bin.name.toLowerCase().includes(q) ||
          (bin.area_name ?? '').toLowerCase().includes(q) ||
          (Array.isArray(bin.items) ? bin.items : []).some((item: string) => item.toLowerCase().includes(q)) ||
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
    }

    if (sort === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'created') {
      filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else if (sort === 'area') {
      filtered.sort((a, b) => {
        const aArea = a.area_name || '\uffff'; // Unassigned sorts last
        const bArea = b.area_name || '\uffff';
        const cmp = aArea.localeCompare(bArea);
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
      });
    } else {
      filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }

    return filtered;
  }, [rawBins, searchQuery, sort, filters]);

  const refresh = useCallback(() => setRefreshCounter((c) => c + 1), []);

  return { bins, isLoading, refresh };
}

export function useBin(id: string | undefined) {
  const { token } = useAuth();
  const [bin, setBin] = useState<Bin | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!id || !token) {
      setBin(undefined);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<Bin>(`/api/bins/${id}`)
      .then((data) => {
        if (!cancelled) setBin(data);
      })
      .catch(() => {
        if (!cancelled) setBin(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, token, refreshCounter]);

  // Listen for bins-changed events
  useEffect(() => {
    const handler = () => setRefreshCounter((c) => c + 1);
    window.addEventListener(BINS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(BINS_CHANGED_EVENT, handler);
  }, []);

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
    },
  });
  notifyBinsChanged();
  return result.id;
}

export async function updateBin(
  id: string,
  changes: Partial<Pick<Bin, 'name' | 'items' | 'notes' | 'tags' | 'icon' | 'color'>> & { areaId?: string | null }
): Promise<void> {
  await apiFetch(`/api/bins/${id}`, {
    method: 'PUT',
    body: changes,
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
  await apiFetch('/api/bins', {
    method: 'POST',
    body: {
      id: bin.id,
      locationId: bin.location_id,
      name: bin.name,
      areaId: bin.area_id,
      items: bin.items,
      notes: bin.notes,
      tags: bin.tags,
      icon: bin.icon,
      color: bin.color,
      shortCode: bin.short_code,
    },
  });
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

export async function lookupBinByCode(shortCode: string): Promise<Bin> {
  return apiFetch<Bin>(`/api/bins/lookup/${encodeURIComponent(shortCode)}`);
}
