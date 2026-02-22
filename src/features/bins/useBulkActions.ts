import { useMemo, useCallback } from 'react';
import { haptic } from '@/lib/utils';
import { deleteBin, restoreBin } from './useBins';
import { pinBin, unpinBin } from '@/features/pins/usePins';
import type { Bin } from '@/types';
import type { Terminology } from '@/lib/terminology';

export function useBulkActions(
  bins: Bin[],
  selectedIds: Set<string>,
  clearSelection: () => void,
  showToast: (toast: { message: string; action?: { label: string; onClick: () => void } }) => void,
  t: Terminology,
) {
  const selected = useMemo(
    () => bins.filter((b) => selectedIds.has(b.id)),
    [bins, selectedIds],
  );

  const majorityUnpinned = useMemo(
    () => selected.filter((b) => !b.is_pinned).length >= selected.length / 2,
    [selected],
  );

  const pinLabel = majorityUnpinned ? 'Pin' : 'Unpin';

  const bulkDelete = useCallback(async () => {
    const snapshots: Bin[] = selected.map((b) => ({ ...b }));
    await Promise.all(selected.map((b) => deleteBin(b.id)));
    haptic([50, 30, 50]);
    clearSelection();
    showToast({
      message: `Deleted ${snapshots.length} ${snapshots.length !== 1 ? t.bins : t.bin}`,
      action: {
        label: 'Undo',
        onClick: async () => {
          for (const bin of snapshots) {
            await restoreBin(bin);
          }
        },
      },
    });
  }, [selected, clearSelection, showToast, t]);

  const bulkPinToggle = useCallback(async () => {
    if (majorityUnpinned) {
      await Promise.all(selected.filter((b) => !b.is_pinned).map((b) => pinBin(b.id)));
    } else {
      await Promise.all(selected.filter((b) => b.is_pinned).map((b) => unpinBin(b.id)));
    }
    clearSelection();
  }, [selected, majorityUnpinned, clearSelection]);

  return { bulkDelete, bulkPinToggle, pinLabel };
}
