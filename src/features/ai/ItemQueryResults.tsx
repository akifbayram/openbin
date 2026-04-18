import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/lib/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { BinItemGroup } from './BinItemGroup';
import { ItemSelectionBar } from './ItemSelectionBar';
import { executeBatch } from './useActionExecutor';
import type { CommandAction } from './useCommand';
import type { QueryMatch } from './useInventoryQuery';
import { useItemQuerySelection } from './useItemQuerySelection';

interface ItemQueryResultsProps {
  matches: QueryMatch[];
  onBinClick: (binId: string, isTrashed?: boolean) => void;
}

const MAX_MATCHES = 8;

export function ItemQueryResults({ matches, onBinClick }: ItemQueryResultsProps) {
  const { canWrite } = usePermissions();
  const { activeLocationId } = useAuth();
  const { showToast } = useToast();

  // Defensive: the prompt says "at most 8 bins", but a misbehaving model
  // could return more. Also dedup — two matches with the same bin_id would
  // share item IDs, cross-wiring selection and tripping React key warnings.
  const visibleMatches = useMemo(() => {
    const seen = new Set<string>();
    const deduped: QueryMatch[] = [];
    for (const m of matches) {
      if (seen.has(m.bin_id)) continue;
      seen.add(m.bin_id);
      deduped.push(m);
      if (deduped.length >= MAX_MATCHES) break;
    }
    return deduped;
  }, [matches]);

  const selection = useItemQuerySelection(visibleMatches);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removedItemIds, setRemovedItemIds] = useState<Set<string>>(new Set());

  async function runBulk(kind: 'checkout' | 'remove') {
    if (!activeLocationId || selection.selectionCount === 0) return;
    const targetedIds = [...selection.selected.keys()];
    setIsBusy(true);
    try {
      const actions: CommandAction[] =
        kind === 'checkout'
          ? buildCheckoutActions(selection.selected, visibleMatches)
          : buildRemoveActions(selection.selected, visibleMatches);

      // Chunk here so selecting many items never trips the server limit.
      // Keep BATCH_CAP in sync with MAX_OPS in server/src/routes/batch.ts.
      const BATCH_CAP = 50;
      let completed = 0;
      let failed = 0;
      for (let i = 0; i < actions.length; i += BATCH_CAP) {
        const chunk = actions.slice(i, i + BATCH_CAP);
        const result = await executeBatch({
          actions: chunk,
          selectedIndices: chunk.map((_, idx) => idx),
          locationId: activeLocationId,
        });
        completed += result.completedActions.length;
        failed += result.failedCount;
      }

      if (failed > 0) {
        showToast({
          message: `${completed} of ${actions.length} actions completed`,
          variant: 'error',
        });
      } else {
        showToast({
          message: `Done — ${selection.selectionCount} ${selection.selectionCount === 1 ? 'item' : 'items'} ${kind === 'checkout' ? 'checked out' : 'removed'}`,
        });
      }
      if (kind === 'remove' && failed === 0) {
        setRemovedItemIds((prev) => {
          const next = new Set(prev);
          for (const id of targetedIds) next.add(id);
          return next;
        });
      }
      selection.clearSelection();
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Bulk action failed'), variant: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  if (visibleMatches.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleMatches.map((match) => (
        <BinItemGroup
          key={match.bin_id}
          match={match}
          canWrite={canWrite}
          selection={selection}
          removedItemIds={removedItemIds}
          onBinClick={onBinClick}
        />
      ))}
      <ItemSelectionBar
        selectionCount={selection.selectionCount}
        onCheckout={() => runBulk('checkout')}
        onRemove={() => setConfirmRemove(true)}
        onClear={selection.clearSelection}
        isBusy={isBusy}
      />
      <Dialog open={confirmRemove} onOpenChange={(v) => { if (!isBusy) setConfirmRemove(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {selection.selectionCount} {selection.selectionCount === 1 ? 'item' : 'items'}?</DialogTitle>
            <DialogDescription>
              This will permanently remove the selected {selection.selectionCount === 1 ? 'item' : 'items'} from their bins.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isBusy}
              onClick={async () => {
                await runBulk('remove');
                setConfirmRemove(false);
              }}
            >
              {isBusy ? 'Removing\u2026' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Local action builders ---

function indexByBinId(matches: QueryMatch[]): Map<string, string> {
  return new Map(matches.map((m) => [m.bin_id, m.name]));
}

function buildCheckoutActions(
  selected: ReturnType<typeof useItemQuerySelection>['selected'],
  matches: QueryMatch[],
): CommandAction[] {
  const nameByBinId = indexByBinId(matches);
  const actions: CommandAction[] = [];
  for (const s of selected.values()) {
    actions.push({
      type: 'checkout_item',
      bin_id: s.binId,
      bin_name: nameByBinId.get(s.binId) ?? '',
      item_name: s.itemName,
    });
  }
  return actions;
}

function buildRemoveActions(
  selected: ReturnType<typeof useItemQuerySelection>['selected'],
  matches: QueryMatch[],
): CommandAction[] {
  const nameByBinId = indexByBinId(matches);
  const byBin = new Map<string, { bin_name: string; items: string[] }>();
  for (const s of selected.values()) {
    const bucket = byBin.get(s.binId) ?? { bin_name: nameByBinId.get(s.binId) ?? '', items: [] };
    bucket.items.push(s.itemName);
    byBin.set(s.binId, bucket);
  }
  const actions: CommandAction[] = [];
  for (const [bin_id, v] of byBin) {
    actions.push({ type: 'remove_items', bin_id, bin_name: v.bin_name, items: v.items });
  }
  return actions;
}
