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
}

export function ItemRow({
  item,
  binId,
  canWrite = false,
  isTrashed = false,
  onOpenBin,
  selected,
  onToggleSelect,
}: ItemRowProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Rename state
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(item.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  // Quantity state
  const [editingQty, setEditingQty] = useState(false);
  const [qtyDraft, setQtyDraft] = useState(item.quantity ?? 0);

  // Remove confirm state
  const [confirmRemove, setConfirmRemove] = useState(false);

  function handleOpen() {
    if (onOpenBin) onOpenBin(binId);
    else navigate(`/bins/${binId}`);
  }

  async function handleCheckout() {
    const result = await checkoutItemSafe(binId, item.id);
    if (result.ok) {
      showToast({ message: `Checked out ${item.name}` });
    } else {
      showToast({ message: result.error, variant: 'error' });
    }
  }

  async function handleRenameSave() {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === item.name) {
      setEditingName(false);
      return;
    }
    const r = await renameItemSafe(binId, item.id, trimmed);
    if (r.ok) showToast({ message: `Renamed to "${trimmed}"` });
    else showToast({ message: r.error, variant: 'error' });
    setEditingName(false);
  }

  async function handleQtyCommit(next: number) {
    const clamped = Math.max(0, Math.floor(next));
    if (clamped === (item.quantity ?? 0)) {
      setEditingQty(false);
      return;
    }
    const r = await updateQuantitySafe(binId, item.id, clamped);
    if (!r.ok) showToast({ message: r.error, variant: 'error' });
    setEditingQty(false);
  }

  async function handleRemove() {
    const r = await removeItemSafe(binId, item.id);
    if (r.ok) showToast({ message: `Removed ${item.name}` });
    else showToast({ message: r.error, variant: 'error' });
    setConfirmRemove(false);
  }

  async function handleRestoreBin() {
    try {
      await restoreBinFromTrash(binId);
      showToast({ message: 'Bin restored' });
      navigate(`/bins/${binId}`);
    } catch (err) {
      showToast({
        message: err instanceof Error && err.message ? err.message : 'Restore failed',
        variant: 'error',
      });
    }
  }

  return (
    <>
      <div className="group flex items-center gap-3 px-3 py-1.5 hover:bg-[var(--bg-hover)] transition-colors">
        {canWrite && !isTrashed && onToggleSelect && (
          <SelectionCheckbox
            checked={!!selected}
            onChange={onToggleSelect}
            label={`Select ${item.name}`}
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
                setDraftName(item.name);
              }
            }}
            onBlur={handleRenameSave}
            className="flex-1 min-w-0 bg-transparent text-[14px] text-[var(--text-primary)] outline-none"
          />
        ) : (
          <span className="flex-1 min-w-0 text-[14px] text-[var(--text-primary)] truncate">
            {item.name}
          </span>
        )}

        {editingQty ? (
          <div className="flex items-center gap-1 bg-[var(--bg-input)] border border-[var(--border-flat)] rounded-[var(--radius-xs)] px-1 py-0.5">
            <button
              type="button"
              aria-label="Decrement"
              onClick={() => setQtyDraft((q) => Math.max(0, q - 1))}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
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
              className="w-10 text-center text-[13px] bg-transparent outline-none tabular-nums"
            />
            <button
              type="button"
              aria-label="Increment"
              onClick={() => setQtyDraft((q) => q + 1)}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : item.quantity != null ? (
          <span className="shrink-0 text-[13px] text-[var(--text-tertiary)] tabular-nums">
            ×{item.quantity}
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
                  setDraftName(item.name);
                  setEditingName(true);
                }
              : undefined
          }
          onAdjustQuantity={
            canWrite
              ? () => {
                  setQtyDraft(item.quantity ?? 0);
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
              This will permanently remove &apos;{item.name}&apos; from the bin.
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
