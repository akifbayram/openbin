import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { restoreBinFromTrash } from '@/features/bins/useBins';
import {
  checkoutItemSafe,
  removeItemSafe,
  renameItemSafe,
  updateQuantitySafe,
} from '@/features/items/itemActions';
import { getErrorMessage } from '@/lib/utils';
import { ItemActionMenu } from './ItemActionMenu';
import { SelectionCheckbox } from './SelectionCheckbox';
import type { EnrichedQueryItem } from './useInventoryQuery';

interface ItemRowProps {
  item: EnrichedQueryItem;
  binId: string;
  canWrite?: boolean;
  isTrashed?: boolean;
  onOpenBin?: (binId: string) => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** External removal signal (e.g. from bulk remove). Hides the row. */
  externallyRemoved?: boolean;
}

export function ItemRow({
  item,
  binId,
  canWrite = false,
  isTrashed = false,
  onOpenBin,
  selected,
  onToggleSelect,
  externallyRemoved = false,
}: ItemRowProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // The Ask AI turn holds a frozen snapshot of the AI response, so the `item`
  // prop never updates after mutations. Track the latest values locally so
  // the row reflects renames/quantity edits/removes without a parent refetch.
  const [displayName, setDisplayName] = useState(item.name);
  const [displayQuantity, setDisplayQuantity] = useState<number | null>(item.quantity);
  const [removed, setRemoved] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(item.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  const [editingQty, setEditingQty] = useState(false);
  const [qtyDraft, setQtyDraft] = useState(displayQuantity ?? 0);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editingQty) {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }
  }, [editingQty]);

  const [confirmRemove, setConfirmRemove] = useState(false);

  function handleOpen() {
    if (onOpenBin) onOpenBin(binId);
    else navigate(`/bin/${binId}`);
  }

  async function handleCheckout() {
    const result = await checkoutItemSafe(binId, item.id);
    if (result.ok) {
      showToast({ message: `Checked out "${displayName}"` });
    } else {
      showToast({ message: result.error, variant: 'error' });
    }
  }

  async function handleRenameSave() {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === displayName) {
      setEditingName(false);
      return;
    }
    const r = await renameItemSafe(binId, item.id, trimmed);
    if (r.ok) {
      setDisplayName(trimmed);
      showToast({ message: `Renamed to "${trimmed}"` });
    } else {
      showToast({ message: r.error, variant: 'error' });
    }
    setEditingName(false);
  }

  async function handleQtyCommit(next: number) {
    const clamped = Math.max(0, Math.floor(next));
    if (clamped === (displayQuantity ?? 0)) {
      setEditingQty(false);
      return;
    }
    const r = await updateQuantitySafe(binId, item.id, clamped);
    if (r.ok) {
      if (r.removed) {
        // Server deletes the item when quantity <= 0. Mirror that in the UI.
        setRemoved(true);
        showToast({ message: `Removed "${displayName}"` });
      } else {
        setDisplayQuantity(r.quantity);
      }
    } else {
      showToast({ message: r.error, variant: 'error' });
    }
    setEditingQty(false);
  }

  async function handleRemove() {
    const r = await removeItemSafe(binId, item.id);
    if (r.ok) {
      setRemoved(true);
      showToast({ message: `Removed "${displayName}"` });
    } else {
      showToast({ message: r.error, variant: 'error' });
    }
    setConfirmRemove(false);
  }

  async function handleRestoreBin() {
    try {
      await restoreBinFromTrash(binId);
      showToast({ message: 'Bin restored' });
      navigate(`/bin/${binId}`);
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Restore failed'), variant: 'error' });
    }
  }

  if (removed || externallyRemoved) return null;

  return (
    <>
      <div className="group flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors">
        {canWrite && !isTrashed && onToggleSelect && (
          <SelectionCheckbox
            checked={!!selected}
            onToggle={onToggleSelect}
            label={`Select ${displayName}`}
          />
        )}
        {editingName ? (
          <input
            ref={nameInputRef}
            aria-label="Item name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleRenameSave();
              }
              if (e.key === 'Escape') {
                setEditingName(false);
                setDraftName(displayName);
              }
            }}
            onBlur={handleRenameSave}
            className="flex-1 min-w-0 bg-[var(--bg-input)] text-[14px] text-[var(--text-primary)] outline-none rounded-[var(--radius-xs)] border border-[var(--border-flat)] px-2 py-0.5 -my-0.5"
          />
        ) : (
          <span className="flex-1 min-w-0 text-[14px] text-[var(--text-primary)] truncate">
            {displayName}
          </span>
        )}

        {editingQty ? (
          <div className="flex items-center gap-0.5 bg-[var(--bg-input)] border border-[var(--border-flat)] rounded-[var(--radius-xs)]">
            <button
              type="button"
              aria-label="Decrement"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setQtyDraft((q) => Math.max(0, q - 1))}
              className="inline-flex items-center justify-center h-7 w-7 rounded-[var(--radius-xs)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              ref={qtyInputRef}
              aria-label="Quantity"
              type="number"
              min={0}
              value={qtyDraft}
              onChange={(e) => setQtyDraft(Number(e.target.value) || 0)}
              onBlur={() => handleQtyCommit(qtyDraft)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQtyCommit(qtyDraft);
                if (e.key === 'Escape') setEditingQty(false);
              }}
              className="w-14 text-center text-[13px] bg-transparent outline-none tabular-nums"
            />
            <button
              type="button"
              aria-label="Increment"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setQtyDraft((q) => q + 1)}
              className="inline-flex items-center justify-center h-7 w-7 rounded-[var(--radius-xs)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : displayQuantity != null ? (
          <span className="shrink-0 text-[13px] text-[var(--text-tertiary)] tabular-nums">
            ×{displayQuantity}
          </span>
        ) : null}

        <ItemActionMenu
          canWrite={canWrite}
          isTrashed={isTrashed}
          onOpenBin={handleOpen}
          onRestoreBin={handleRestoreBin}
          onCheckout={canWrite ? handleCheckout : undefined}
          onRename={
            canWrite
              ? () => {
                  setDraftName(displayName);
                  setEditingName(true);
                }
              : undefined
          }
          onAdjustQuantity={
            canWrite
              ? () => {
                  setQtyDraft(displayQuantity ?? 0);
                  setEditingQty(true);
                }
              : undefined
          }
          onRemove={canWrite ? () => setConfirmRemove(true) : undefined}
        />
      </div>

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove item?</DialogTitle>
            <DialogDescription>
              This will permanently remove &quot;{displayName}&quot; from the bin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
