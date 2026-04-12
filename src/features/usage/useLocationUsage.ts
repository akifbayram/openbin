import { Events } from '@/lib/eventBus';
import { useListData } from '@/lib/useListData';
import type { LocationUsageDay } from '@/types';

export function useLocationUsage(locationId: string | null | undefined) {
  const { data, isLoading, error, refresh } = useListData<LocationUsageDay>(
    locationId ? `/api/locations/${locationId}/usage` : null,
    [Events.BIN_USAGE, Events.BINS],
  );
  return { usage: data, isLoading, error, refresh };
}
