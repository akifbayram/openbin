import { useCallback, useState } from 'react';
import { useAiStream } from '@/features/ai/useAiStream';
import { addBin, deleteBin } from '@/features/bins/useBins';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import type { Bin } from '@/types';
import { parsePartialReorg, type PartialReorgResult } from './parsePartialReorg';

interface ReorgResponse {
  bins: Array<{ name: string; items: string[] }>;
  summary: string;
}

export function useReorganize() {
  const { activeLocationId } = useAuth();
  const { result, isStreaming, error, partialText, stream, cancel, clear } =
    useAiStream<ReorgResponse>('/api/ai/reorganize/stream', 'Failed to generate reorganization');
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const partialResult: PartialReorgResult = partialText
    ? parsePartialReorg(partialText)
    : { bins: [], summary: '' };

  const startReorg = useCallback(
    (bins: Bin[], maxBins?: number, areaId?: string, areaName?: string) => {
      if (!activeLocationId) return;
      setApplyError(null);
      stream({
        locationId: activeLocationId,
        bins: bins.map((b) => ({
          id: b.id,
          name: b.name,
          items: b.items.map((i) => i.name),
          areaId: b.area_id,
          areaName: b.area_name,
        })),
        maxBins: maxBins || undefined,
        areaId: areaId || undefined,
        areaName: areaName || undefined,
      });
    },
    [activeLocationId, stream],
  );

  const apply = useCallback(
    async (originalBinIds: string[], areaId?: string) => {
      if (!result || !activeLocationId) return;
      setIsApplying(true);
      setApplyError(null);
      try {
        await Promise.all(originalBinIds.map((id) => deleteBin(id)));
        await Promise.all(
          result.bins.map((b) =>
            addBin({
              name: b.name,
              locationId: activeLocationId,
              items: b.items,
              areaId: areaId ?? null,
            }),
          ),
        );
        notify(Events.BINS);
        notify(Events.AREAS);
      } catch (err) {
        setApplyError(err instanceof Error ? err.message : 'Failed to apply reorganization');
      } finally {
        setIsApplying(false);
      }
    },
    [result, activeLocationId],
  );

  return {
    result,
    partialResult,
    isStreaming,
    error,
    applyError,
    isApplying,
    startReorg,
    apply,
    cancel,
    clear,
  };
}
