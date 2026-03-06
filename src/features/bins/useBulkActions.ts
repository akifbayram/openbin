import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toaster } from '@/components/ui/toaster';
import { pinBin, unpinBin } from '@/features/pins/usePins';
import { useAuth } from '@/lib/auth';
import type { Terminology } from '@/lib/terminology';
import { haptic } from '@/lib/utils';
import type { Bin } from '@/types';
import { addBin, deleteBin, restoreBin } from './useBins';

export function useBulkActions(
  bins: Bin[],
  selectedIds: Set<string>,
  clearSelection: () => void,
  t: Terminology,
) {
  const { activeLocationId } = useAuth();
  const navigate = useNavigate();
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
    toaster.create({
      description: `Deleted ${snapshots.length} ${snapshots.length !== 1 ? t.bins : t.bin}`,
      action: {
        label: 'Undo',
        onClick: async () => {
          for (const bin of snapshots) {
            await restoreBin(bin);
          }
        },
      },
    });
  }, [selected, clearSelection, t]);

  const bulkPinToggle = useCallback(async () => {
    if (majorityUnpinned) {
      await Promise.all(selected.filter((b) => !b.is_pinned).map((b) => pinBin(b.id)));
    } else {
      await Promise.all(selected.filter((b) => b.is_pinned).map((b) => unpinBin(b.id)));
    }
    clearSelection();
  }, [selected, majorityUnpinned, clearSelection]);

  const bulkDuplicate = useCallback(async () => {
    if (!activeLocationId) return;
    const ids: string[] = [];
    for (const bin of selected) {
      const newBin = await addBin({
        name: `${bin.name} (copy)`,
        locationId: activeLocationId,
        items: bin.items.map((i) => i.name),
        notes: bin.notes,
        tags: [...bin.tags],
        areaId: bin.area_id,
        icon: bin.icon,
        color: bin.color,
        cardStyle: bin.card_style,
        visibility: bin.visibility,
        customFields: bin.custom_fields ? { ...bin.custom_fields } : undefined,
      });
      ids.push(newBin.id);
    }
    clearSelection();
    if (ids.length === 1) {
      navigate(`/bin/${ids[0]}`);
      toaster.create({ description: `Duplicated "${selected[0].name}"` });
    } else {
      toaster.create({ description: `Duplicated ${ids.length} ${t.bins}` });
    }
  }, [selected, activeLocationId, clearSelection, navigate, t]);

  return { bulkDelete, bulkPinToggle, bulkDuplicate, pinLabel };
}
