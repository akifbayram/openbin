import { useState } from 'react';
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

export function ItemQueryResults({ matches, onBinClick }: ItemQueryResultsProps) {
  const { canWrite } = usePermissions();
  const { activeLocationId } = useAuth();
  const { showToast } = useToast();
  const selection = useItemQuerySelection(matches);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function runBulk(kind: 'checkout' | 'remove') {
    if (!activeLocationId || selection.selectionCount === 0) return;
    setIsBusy(true);
    try {
      const actions: CommandAction[] =
        kind === 'checkout'
          ? buildCheckoutActions(selection.selected, matches)
          : buildRemoveActions(selection.selected, matches);
      const result = await executeBatch({
        actions,
        selectedIndices: actions.map((_, i) => i),
        locationId: activeLocationId,
      });
      if (result.failedCount > 0) {
        showToast({
          message: `${result.completedActions.length} of ${actions.length} actions completed`,
          variant: 'error',
        });
      } else {
        showToast({
          message: `Done — ${selection.selectionCount} ${selection.selectionCount === 1 ? 'item' : 'items'} ${kind === 'checkout' ? 'checked out' : 'removed'}`,
        });
      }
      selection.clearSelection();
    } catch (err) {
      showToast({ message: (err as Error).message ?? 'Bulk action failed', variant: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  if (matches.length === 0) return null;

  return (
    <div className="space-y-2">
      {matches.map((match) => (
        <BinItemGroup
          key={match.bin_id}
          match={match}
          canWrite={canWrite}
          selection={selection}
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
      {confirmRemove && (
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
      )}
    </div>
  );
}

// --- Local action builders ---

function buildCheckoutActions(
  selected: ReturnType<typeof useItemQuerySelection>['selected'],
  matches: QueryMatch[],
): CommandAction[] {
  const actions: CommandAction[] = [];
  for (const s of selected.values()) {
    const match = matches.find((m) => m.bin_id === s.binId);
    actions.push({
      type: 'checkout_item',
      bin_id: s.binId,
      bin_name: match?.name ?? '',
      item_name: s.itemName,
    });
  }
  return actions;
}

function buildRemoveActions(
  selected: ReturnType<typeof useItemQuerySelection>['selected'],
  matches: QueryMatch[],
): CommandAction[] {
  const byBin = new Map<string, { bin_name: string; items: string[] }>();
  for (const s of selected.values()) {
    const match = matches.find((m) => m.bin_id === s.binId);
    const bucket = byBin.get(s.binId) ?? { bin_name: match?.name ?? '', items: [] };
    bucket.items.push(s.itemName);
    byBin.set(s.binId, bucket);
  }
  const actions: CommandAction[] = [];
  for (const [bin_id, v] of byBin) {
    actions.push({ type: 'remove_items', bin_id, bin_name: v.bin_name, items: v.items });
  }
  return actions;
}
