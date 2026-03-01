import { notifyBinsChanged } from '@/features/bins/useBins';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import { useListData } from '@/lib/useListData';
import type { Bin } from '@/types';

export const notifyPinsChanged = () => notify(Events.PINS);

export function usePinnedBins() {
  const { activeLocationId, token } = useAuth();
  const { data: pinnedBins, isLoading } = useListData<Bin>(
    token && activeLocationId
      ? `/api/bins/pinned?location_id=${encodeURIComponent(activeLocationId)}`
      : null,
    [Events.PINS, Events.BINS],
  );
  return { pinnedBins, isLoading };
}

export async function pinBin(binId: string): Promise<void> {
  await apiFetch(`/api/bins/${binId}/pin`, { method: 'POST' });
  notifyPinsChanged();
  notifyBinsChanged();
}

export async function unpinBin(binId: string): Promise<void> {
  await apiFetch(`/api/bins/${binId}/pin`, { method: 'DELETE' });
  notifyPinsChanged();
  notifyBinsChanged();
}

export async function reorderPins(binIds: string[]): Promise<void> {
  await apiFetch('/api/bins/pinned/reorder', {
    method: 'PUT',
    body: { bin_ids: binIds },
  });
  notifyPinsChanged();
}
