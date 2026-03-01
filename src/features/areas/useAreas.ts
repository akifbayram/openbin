import { useEffect, useState } from 'react';
import { notifyBinsChanged } from '@/features/bins/useBins';
import { apiFetch } from '@/lib/api';
import { Events, notify, useRefreshOn } from '@/lib/eventBus';
import type { Area, ListResponse } from '@/types';

export const notifyAreasChanged = () => notify(Events.AREAS);

interface AreasResponse extends ListResponse<Area> {
  unassigned_count: number;
}

export function useAreaList(locationId: string | null | undefined) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const refreshCounter = useRefreshOn(Events.AREAS);

  const path = locationId ? `/api/locations/${encodeURIComponent(locationId)}/areas` : null;

  useEffect(() => {
    if (!path) {
      setAreas([]);
      setUnassignedCount(0);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<AreasResponse>(path)
      .then((resp) => {
        if (!cancelled) {
          setAreas(resp.results);
          setUnassignedCount(resp.unassigned_count);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAreas([]);
          setUnassignedCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [path, refreshCounter]);

  return { areas, unassignedCount, isLoading };
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
