import { Events } from '@/lib/eventBus';
import { useListData } from '@/lib/useListData';
import type { UsageDay } from '@/types';

export function useBinUsage(binId: string | null | undefined) {
  const { data, isLoading, error, refresh } = useListData<UsageDay>(
    binId ? `/api/bins/${binId}/usage` : null,
    [Events.BIN_USAGE, Events.BINS],
  );
  return { usage: data, isLoading, error, refresh };
}
