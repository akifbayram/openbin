import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { notifyBinsChanged } from '@/features/bins/useBins';
import type { Area } from '@/types';

const AREAS_CHANGED_EVENT = 'areas-changed';

export function notifyAreasChanged() {
  window.dispatchEvent(new Event(AREAS_CHANGED_EVENT));
}

export function useAreaList(locationId: string | null | undefined) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!locationId) {
      setAreas([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<Area[]>(`/api/locations/${encodeURIComponent(locationId)}/areas`)
      .then((data) => {
        if (!cancelled) setAreas(data);
      })
      .catch(() => {
        if (!cancelled) setAreas([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [locationId, refreshCounter]);

  useEffect(() => {
    const handler = () => setRefreshCounter((c) => c + 1);
    window.addEventListener(AREAS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AREAS_CHANGED_EVENT, handler);
  }, []);

  return { areas, isLoading };
}

export async function createArea(locationId: string, name: string): Promise<Area> {
  const area = await apiFetch<Area>(`/api/locations/${encodeURIComponent(locationId)}/areas`, {
    method: 'POST',
    body: { name },
  });
  notifyAreasChanged();
  return area;
}

export async function updateArea(locationId: string, areaId: string, name: string): Promise<void> {
  await apiFetch(`/api/locations/${encodeURIComponent(locationId)}/areas/${encodeURIComponent(areaId)}`, {
    method: 'PUT',
    body: { name },
  });
  notifyAreasChanged();
  notifyBinsChanged();
}

export async function deleteArea(locationId: string, areaId: string): Promise<void> {
  await apiFetch(`/api/locations/${encodeURIComponent(locationId)}/areas/${encodeURIComponent(areaId)}`, {
    method: 'DELETE',
  });
  notifyAreasChanged();
  notifyBinsChanged();
}
