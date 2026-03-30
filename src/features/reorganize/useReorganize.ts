import { useCallback, useState } from 'react';
import { useAiStream } from '@/features/ai/useAiStream';
import { addBin, deleteBin } from '@/features/bins/useBins';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import { getErrorMessage } from '@/lib/utils';
import type { Bin } from '@/types';
import { type PartialReorgResult, parsePartialReorg } from './parsePartialReorg';

export interface ReorgResponse {
  bins: Array<{ name: string; items: string[]; tags?: string[] }>;
  summary: string;
}

export interface ReorgOptions {
  userNotes?: string;
  strictness?: 'conservative' | 'moderate' | 'aggressive';
  granularity?: 'broad' | 'medium' | 'specific';
  ambiguousPolicy?: 'best-fit' | 'multi-bin' | 'misc-bin';
  duplicates?: 'allow' | 'force-single';
  outliers?: 'dedicated' | 'force-closest';
  minItemsPerBin?: number;
  maxItemsPerBin?: number;
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
    (bins: Bin[], maxBins?: number, areaId?: string, areaName?: string, options?: ReorgOptions) => {
      if (!activeLocationId) return;
      setApplyError(null);
      stream({
        locationId: activeLocationId,
        bins: bins.map((b) => ({
          id: b.id,
          name: b.name,
          items: b.items.map((i) => i.name),
          tags: b.tags,
          areaId: b.area_id,
          areaName: b.area_name,
        })),
        maxBins: maxBins || undefined,
        areaId: areaId || undefined,
        areaName: areaName || undefined,
        ...options,
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
              tags: b.tags,
              areaId: areaId ?? null,
            }),
          ),
        );
        notify(Events.BINS);
        notify(Events.AREAS);
      } catch (err) {
        setApplyError(getErrorMessage(err, 'Failed to apply reorganization'));
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
