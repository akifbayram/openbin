import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { useAreaList, createArea, updateArea, deleteArea } from '@/features/areas/useAreas';
import { addBin, updateBin, deleteBin, restoreBin, notifyBinsChanged, addItemsToBin, reorderItems, restoreBinFromTrash } from '@/features/bins/useBins';
import { pinBin, unpinBin } from '@/features/pins/usePins';
import { setTagColor } from '@/features/tags/useTagColors';
import { notify, Events } from '@/lib/eventBus';
import { apiFetch } from '@/lib/api';
import type { CommandAction } from './useCommand';
import type { Bin } from '@/types';

interface UseActionExecutorOptions {
  actions: CommandAction[] | null;
  checkedActions: Map<number, boolean>;
  onComplete: () => void;
}

export function useActionExecutor({ actions, checkedActions, onComplete }: UseActionExecutorOptions) {
  const { activeLocationId } = useAuth();
  const { showToast } = useToast();
  const { areas } = useAreaList(activeLocationId);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingProgress, setExecutingProgress] = useState({ current: 0, total: 0 });

  async function resolveAreaId(areaName: string): Promise<string> {
    const existing = areas.find(
      (a) => a.name.toLowerCase() === areaName.toLowerCase()
    );
    if (existing) return existing.id;
    const newArea = await createArea(activeLocationId!, areaName);
    return newArea.id;
  }

  const executeActions = useCallback(async () => {
    if (!actions || !activeLocationId) return;

    const selected = actions.filter((_, i) => checkedActions.get(i) !== false);
    if (selected.length === 0) return;

    setIsExecuting(true);
    setExecutingProgress({ current: 0, total: selected.length });
    let completed = 0;

    for (let idx = 0; idx < selected.length; idx++) {
      const action = selected[idx];
      setExecutingProgress({ current: idx + 1, total: selected.length });
      try {
        switch (action.type) {
          case 'add_items': {
            await addItemsToBin(action.bin_id, action.items);
            break;
          }
          case 'remove_items': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const remaining = (bin.items || []).filter(
              (item) => !action.items.some((r) => r.toLowerCase() === item.name.toLowerCase())
            );
            await updateBin(action.bin_id, { items: remaining.map((i) => i.name) });
            break;
          }
          case 'modify_item': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const modified = (bin.items || []).map((item) =>
              item.name.toLowerCase() === action.old_item.toLowerCase() ? action.new_item : item.name
            );
            await updateBin(action.bin_id, { items: modified });
            break;
          }
          case 'create_bin': {
            const areaId = action.area_name ? await resolveAreaId(action.area_name) : null;
            await addBin({
              name: action.name,
              locationId: activeLocationId,
              items: action.items,
              tags: action.tags,
              notes: action.notes,
              areaId,
              icon: action.icon,
              color: action.color,
            });
            break;
          }
          case 'delete_bin': {
            const deleted = await deleteBin(action.bin_id);
            showToast({
              message: `Deleted "${action.bin_name}"`,
              action: {
                label: 'Undo',
                onClick: () => restoreBin(deleted),
              },
            });
            break;
          }
          case 'add_tags': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const merged = [...new Set([...(bin.tags || []), ...action.tags])];
            await updateBin(action.bin_id, { tags: merged });
            break;
          }
          case 'remove_tags': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const filtered = (bin.tags || []).filter(
              (t) => !action.tags.some((r) => r.toLowerCase() === t.toLowerCase())
            );
            await updateBin(action.bin_id, { tags: filtered });
            break;
          }
          case 'modify_tag': {
            const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
            const renamed = (bin.tags || []).map((t) =>
              t.toLowerCase() === action.old_tag.toLowerCase() ? action.new_tag : t
            );
            await updateBin(action.bin_id, { tags: renamed });
            break;
          }
          case 'set_area': {
            let areaId = action.area_id;
            if (!areaId && action.area_name) {
              areaId = await resolveAreaId(action.area_name);
            }
            await updateBin(action.bin_id, { areaId });
            break;
          }
          case 'set_notes': {
            if (action.mode === 'clear') {
              await updateBin(action.bin_id, { notes: '' });
            } else if (action.mode === 'append') {
              const bin = await apiFetch<Bin>(`/api/bins/${action.bin_id}`);
              const appended = bin.notes ? `${bin.notes}\n${action.notes}` : action.notes;
              await updateBin(action.bin_id, { notes: appended });
            } else {
              await updateBin(action.bin_id, { notes: action.notes });
            }
            break;
          }
          case 'set_icon':
            await updateBin(action.bin_id, { icon: action.icon });
            break;
          case 'set_color':
            await updateBin(action.bin_id, { color: action.color });
            break;
          case 'update_bin': {
            const updates: Record<string, unknown> = {};
            if (action.name !== undefined) updates.name = action.name;
            if (action.notes !== undefined) updates.notes = action.notes;
            if (action.tags !== undefined) updates.tags = action.tags;
            if (action.icon !== undefined) updates.icon = action.icon;
            if (action.color !== undefined) updates.color = action.color;
            if (action.visibility !== undefined) updates.visibility = action.visibility;
            if (action.area_name !== undefined) {
              const areaId = action.area_name ? await resolveAreaId(action.area_name) : null;
              updates.areaId = areaId;
            }
            await updateBin(action.bin_id, updates);
            break;
          }
          case 'restore_bin':
            await restoreBinFromTrash(action.bin_id);
            break;
          case 'duplicate_bin':
            await apiFetch(`/api/bins/${action.bin_id}/duplicate`, {
              method: 'POST',
              body: action.new_name ? { name: action.new_name } : {},
            });
            break;
          case 'pin_bin':
            await pinBin(action.bin_id);
            notify(Events.PINS);
            break;
          case 'unpin_bin':
            await unpinBin(action.bin_id);
            notify(Events.PINS);
            break;
          case 'rename_area':
            await updateArea(activeLocationId!, action.area_id, action.new_name);
            notify(Events.AREAS);
            break;
          case 'delete_area':
            await deleteArea(activeLocationId!, action.area_id);
            notify(Events.AREAS);
            break;
          case 'set_tag_color':
            await setTagColor(activeLocationId!, action.tag, action.color);
            notify(Events.TAG_COLORS);
            break;
          case 'reorder_items':
            await reorderItems(action.bin_id, action.item_ids);
            break;
        }
        completed++;
      } catch (err) {
        console.error(`Failed to execute action ${action.type}:`, err);
      }
    }

    setIsExecuting(false);
    setExecutingProgress({ current: 0, total: 0 });
    notifyBinsChanged();

    if (completed === selected.length) {
      showToast({ message: `${completed} action${completed !== 1 ? 's' : ''} completed` });
    } else {
      showToast({ message: `${completed} of ${selected.length} actions completed` });
    }

    onComplete();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, checkedActions, activeLocationId, areas, onComplete, showToast]);

  return { isExecuting, executingProgress, executeActions };
}
