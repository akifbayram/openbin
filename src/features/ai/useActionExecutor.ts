import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui/toast';
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
  /** Positions of completed actions in the original `actions[]` array (not `selected[]`). */
  completedActionIndices: number[];
  createdBins: CreatedBinInfo[];
  failedCount: number;
}

/** Action types that affect non-bin entities and need extra event bus notifications. */
const AREA_TYPES = new Set(['set_area', 'rename_area', 'delete_area', 'create_bin']);
const PIN_TYPES = new Set(['pin_bin', 'unpin_bin']);
const TAG_COLOR_TYPES = new Set(['set_tag_color']);
const CHECKOUT_TYPES = new Set(['checkout_item', 'return_item']);

interface ExecuteBatchOptions {
  actions: CommandAction[];
  /** Indices into `actions` that should be executed. */
  selectedIndices: number[];
  locationId: string;
  /** Invoked for `delete_bin` action results so the caller can surface an undo toast. */
  onUndoToast?: (message: string, undo: () => void) => void;
}

/**
 * Execute a batch of pre-selected CommandActions against `/api/batch` and
 * notify the event bus. Pure async function — safe to call from any hook.
 */
export async function executeBatch(opts: ExecuteBatchOptions): Promise<ExecutionResult> {
  const { actions, selectedIndices, locationId, onUndoToast } = opts;
  const selected = selectedIndices.map((i) => actions[i]);
  if (selected.length === 0) {
    return { completedActions: [], completedActionIndices: [], createdBins: [], failedCount: 0 };
  }

  const { results, errors } = await apiFetch<BatchResponse>('/api/batch', {
    method: 'POST',
    body: { locationId, operations: selected },
  });

  const completedActions: CommandAction[] = [];
  const completedActionIndices: number[] = [];
  const createdBins: CreatedBinInfo[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.success) {
      completedActions.push(selected[i]);
      completedActionIndices.push(selectedIndices[i]);
      if (r.type === 'create_bin' || r.type === 'duplicate_bin') {
        createdBins.push({
          id: r.bin_id ?? '',
          name: r.bin_name ?? '',
          icon: (selected[i] as { icon?: string }).icon || '',
          color: (selected[i] as { color?: string }).color || '',
        });
      }
      if (r.type === 'delete_bin' && r.bin_id && onUndoToast) {
        const binId = r.bin_id;
        onUndoToast(`Deleted "${r.bin_name}"`, () => {
          apiFetch(`/api/bins/${binId}/restore`, { method: 'POST' }).then(() => notifyBinsChanged());
        });
      }
    }
  }

  const actionTypes = new Set(selected.map((a) => a.type));
  notifyBinsChanged();
  if ([...actionTypes].some((t) => AREA_TYPES.has(t))) notify(Events.AREAS);
  if ([...actionTypes].some((t) => PIN_TYPES.has(t))) notify(Events.PINS);
  if ([...actionTypes].some((t) => TAG_COLOR_TYPES.has(t))) notify(Events.TAG_COLORS);
  if ([...actionTypes].some((t) => CHECKOUT_TYPES.has(t))) notify(Events.CHECKOUTS);

  if (errors.length > 0) {
    console.error('Batch errors:', errors);
  }

  return {
    completedActions,
    completedActionIndices,
    createdBins,
    failedCount: selected.length - completedActions.length,
  };
}

interface UseActionExecutorOptions {
  actions: CommandAction[] | null;
  checkedActions: Map<number, boolean>;
  onComplete: (result: ExecutionResult) => void;
}

export function useActionExecutor({ actions, checkedActions, onComplete }: UseActionExecutorOptions) {
  const { activeLocationId } = useAuth();
  const { showToast } = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingProgress, setExecutingProgress] = useState({ current: 0, total: 0 });

  const executeActions = useCallback(async () => {
    if (!actions || !activeLocationId) return;

    const selectedIndices: number[] = [];
    for (let i = 0; i < actions.length; i++) {
      if (checkedActions.get(i) !== false) selectedIndices.push(i);
    }
    if (selectedIndices.length === 0) return;

    setIsExecuting(true);
    setExecutingProgress({ current: 0, total: selectedIndices.length });

    try {
      const result = await executeBatch({
        actions,
        selectedIndices,
        locationId: activeLocationId,
        onUndoToast: (message, undo) =>
          showToast({ message, action: { label: 'Undo', onClick: undo } }),
      });
      setExecutingProgress({ current: selectedIndices.length, total: selectedIndices.length });
      if (result.failedCount > 0) {
        showToast({
          message: `${result.completedActions.length} of ${selectedIndices.length} actions completed`,
        });
      }
      onComplete(result);
    } catch (err) {
      console.error('Batch execution failed:', err);
      showToast({ message: 'Failed to execute actions' });
      onComplete({
        completedActions: [],
        completedActionIndices: [],
        createdBins: [],
        failedCount: selectedIndices.length,
      });
    } finally {
      setIsExecuting(false);
      setExecutingProgress({ current: 0, total: 0 });
    }
  }, [actions, checkedActions, activeLocationId, onComplete, showToast]);

  return { isExecuting, executingProgress, executeActions };
}
