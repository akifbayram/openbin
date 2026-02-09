import { useMemo, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Bin } from '@/types';

const BINS_CHANGED_EVENT = 'bins-changed';

/** Notify all useBinList / useBin instances to refetch */
export function notifyBinsChanged() {
  window.dispatchEvent(new Event(BINS_CHANGED_EVENT));
}

export type SortOption = 'updated' | 'created' | 'name';

export function useBinList(searchQuery?: string, sort: SortOption = 'updated') {
  const { activeHomeId, token } = useAuth();
  const [rawBins, setRawBins] = useState<Bin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!token || !activeHomeId) {
      setRawBins([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<Bin[]>(`/api/bins?home_id=${encodeURIComponent(activeHomeId)}`)
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
  }, [token, activeHomeId, refreshCounter]);

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
          bin.location.toLowerCase().includes(q) ||
          (Array.isArray(bin.items) ? bin.items : []).some((item: string) => item.toLowerCase().includes(q)) ||
          bin.notes.toLowerCase().includes(q) ||
          (Array.isArray(bin.tags) ? bin.tags : []).some((tag: string) => tag.toLowerCase().includes(q))
      );
    }

    if (sort === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'created') {
      filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }

    return filtered;
  }, [rawBins, searchQuery, sort]);

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
  homeId: string;
  items?: string[];
  notes?: string;
  tags?: string[];
  location?: string;
  icon?: string;
  color?: string;
}

export async function addBin(options: AddBinOptions): Promise<string> {
  const result = await apiFetch<{ id: string }>('/api/bins', {
    method: 'POST',
    body: {
      homeId: options.homeId,
      name: options.name,
      location: options.location ?? '',
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
  changes: Partial<Pick<Bin, 'name' | 'location' | 'items' | 'notes' | 'tags' | 'icon' | 'color'>>
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
      homeId: bin.home_id,
      name: bin.name,
      location: bin.location,
      items: bin.items,
      notes: bin.notes,
      tags: bin.tags,
      icon: bin.icon,
      color: bin.color,
    },
  });
  notifyBinsChanged();
}
