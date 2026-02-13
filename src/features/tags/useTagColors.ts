import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { TagColor, ListResponse } from '@/types';

const TAG_COLORS_CHANGED_EVENT = 'tag-colors-changed';

function notifyTagColorsChanged() {
  window.dispatchEvent(new Event(TAG_COLORS_CHANGED_EVENT));
}

export function useTagColors() {
  const { activeLocationId, token } = useAuth();
  const [rawTagColors, setRawTagColors] = useState<TagColor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!token || !activeLocationId) {
      setRawTagColors([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<ListResponse<TagColor>>(`/api/tag-colors?location_id=${encodeURIComponent(activeLocationId)}`)
      .then((data) => {
        if (!cancelled) setRawTagColors(data.results);
      })
      .catch(() => {
        if (!cancelled) setRawTagColors([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, activeLocationId, refreshCounter]);

  useEffect(() => {
    const handler = () => setRefreshCounter((c) => c + 1);
    window.addEventListener(TAG_COLORS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(TAG_COLORS_CHANGED_EVENT, handler);
  }, []);

  const tagColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const tc of rawTagColors) {
      map.set(tc.tag, tc.color);
    }
    return map;
  }, [rawTagColors]);

  return { tagColors, isLoading };
}

export async function setTagColor(locationId: string, tag: string, color: string): Promise<void> {
  await apiFetch('/api/tag-colors', {
    method: 'PUT',
    body: { locationId, tag, color },
  });
  notifyTagColorsChanged();
}

export async function removeTagColor(locationId: string, tag: string): Promise<void> {
  await apiFetch(`/api/tag-colors/${encodeURIComponent(tag)}?location_id=${encodeURIComponent(locationId)}`, {
    method: 'DELETE',
  });
  notifyTagColorsChanged();
}
