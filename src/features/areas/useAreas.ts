import { apiFetch } from '@/lib/api';
import { Events, notify } from '@/lib/eventBus';
import { useListData } from '@/lib/useListData';
import { notifyBinsChanged } from '@/features/bins/useBins';
import type { Area } from '@/types';

export const notifyAreasChanged = () => notify(Events.AREAS);

export function useAreaList(locationId: string | null | undefined) {
  const { data: areas, isLoading } = useListData<Area>(
    locationId ? `/api/locations/${encodeURIComponent(locationId)}/areas` : null,
    [Events.AREAS],
  );
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
