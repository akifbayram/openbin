import { useCallback, useState } from 'react';
import { toaster } from '@/components/ui/toaster';
import type { CreatedBinInfo } from '@/features/bins/BinCreateSuccess';
import { notifyBinsChanged } from '@/features/bins/useBins';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import type { CommandAction } from './useCommand';

interface ActionResult {
  type: string;
  success: boolean;
  details: string;
  bin_id?: string;
  bin_name?: string;
  error?: string;
}

interface BatchResponse {
  results: ActionResult[];
  errors: string[];
}

export interface ExecutionResult {
  completedActions: CommandAction[];
  createdBins: CreatedBinInfo[];
  failedCount: number;
}

interface UseActionExecutorOptions {
  actions: CommandAction[] | null;
  checkedActions: Map<number, boolean>;
  onComplete: (result: ExecutionResult) => void;
}

/** Action types that affect non-bin entities and need extra event bus notifications. */
const AREA_TYPES = new Set(['set_area', 'rename_area', 'delete_area', 'create_bin']);
const PIN_TYPES = new Set(['pin_bin', 'unpin_bin']);
const TAG_COLOR_TYPES = new Set(['set_tag_color']);

export function useActionExecutor({ actions, checkedActions, onComplete }: UseActionExecutorOptions) {
  const { activeLocationId } = useAuth();
    const [isExecuting, setIsExecuting] = useState(false);
  const [executingProgress, setExecutingProgress] = useState({ current: 0, total: 0 });

  const executeActions = useCallback(async () => {
    if (!actions || !activeLocationId) return;

    const selected = actions.filter((_, i) => checkedActions.get(i) !== false);
    if (selected.length === 0) return;

    setIsExecuting(true);
    setExecutingProgress({ current: 0, total: selected.length });

    try {
      const { results, errors } = await apiFetch<BatchResponse>('/api/batch', {
        method: 'POST',
        body: { locationId: activeLocationId, operations: selected },
      });

      // Map batch results back to completed actions and created bins
      const completedActions: CommandAction[] = [];
      const createdBins: CreatedBinInfo[] = [];

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.success) {
          completedActions.push(selected[i]);
          if (r.type === 'create_bin' || r.type === 'duplicate_bin') {
            createdBins.push({
              id: r.bin_id!,
              name: r.bin_name!,
              icon: (selected[i] as { icon?: string }).icon || '',
              color: (selected[i] as { color?: string }).color || '',
            });
          }
          // Show undo toast for deletes
          if (r.type === 'delete_bin' && r.bin_id) {
            const binId = r.bin_id;
            toaster.create({
              description: `Deleted "${r.bin_name}"`,
              action: {
                label: 'Undo',
                onClick: () => {
                  apiFetch(`/api/bins/${binId}/restore`, { method: 'POST' }).then(() => notifyBinsChanged());
                },
              },
            });
          }
        }
      }

      // Fire event bus notifications based on action types present
      const actionTypes = new Set(selected.map((a) => a.type));
      notifyBinsChanged();
      if ([...actionTypes].some((t) => AREA_TYPES.has(t))) notify(Events.AREAS);
      if ([...actionTypes].some((t) => PIN_TYPES.has(t))) notify(Events.PINS);
      if ([...actionTypes].some((t) => TAG_COLOR_TYPES.has(t))) notify(Events.TAG_COLORS);

      const failedCount = selected.length - completedActions.length;
      if (failedCount > 0) {
        toaster.create({ description: `${completedActions.length} of ${selected.length} actions completed` });
      }
      if (errors.length > 0) {
        console.error('Batch errors:', errors);
      }

      setExecutingProgress({ current: selected.length, total: selected.length });
      onComplete({ completedActions, createdBins, failedCount });
    } catch (err) {
      console.error('Batch execution failed:', err);
      toaster.create({ description: 'Failed to execute actions' });
      onComplete({ completedActions: [], createdBins: [], failedCount: selected.length });
    } finally {
      setIsExecuting(false);
      setExecutingProgress({ current: 0, total: 0 });
    }
  }, [actions, checkedActions, activeLocationId, onComplete]);

  return { isExecuting, executingProgress, executeActions };
}
