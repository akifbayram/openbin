import { ArrowUpDown, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { BinItem } from '@/types';
import { removeItemFromBin, renameItem, reorderItems, updateItemQuantity } from './useBins';

interface ItemListProps {
  items: BinItem[];
  binId: string;
  readOnly?: boolean;
}

type SortMode = 'manual' | 'az' | 'za';

interface ItemRowProps {
  text: string;
  quantity: number | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string, quantity: number | null) => void;
  onCancel: () => void;
  onDelete: () => void;
  onQuantityChange: (newQty: number) => void;
}

const SWIPE_THRESHOLD = 80;

function ItemRow({ text, quantity, isEditing, onStartEdit, onSave, onCancel, onDelete, onQuantityChange }: ItemRowProps) {
  const [editValue, setEditValue] = useState(text);
  const [editQuantity, setEditQuantity] = useState<string>(quantity != null ? String(quantity) : '');
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleStartEdit() {
    setEditValue(text);
    setEditQuantity(quantity != null ? String(quantity) : '');
    onStartEdit();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleSave() {
    const trimmed = editValue.trim();
    const parsedQty = editQuantity.trim() === '' ? null : Number.parseInt(editQuantity, 10);
    const finalQty = parsedQty != null && Number.isFinite(parsedQty) && parsedQty >= 1 ? parsedQty : (editQuantity.trim() === '' ? null : quantity);
    if (trimmed && (trimmed !== text || finalQty !== quantity)) {
      onSave(trimmed, finalQty);
    } else {
      onCancel();
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (isEditing) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    swipingRef.current = false;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (isEditing || !touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (!swipingRef.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipingRef.current = true;
    }

    if (swipingRef.current) {
      e.preventDefault();
      setSwipeX(Math.min(0, dx));
    }
  }

  function handleTouchEnd() {
    if (!touchStartRef.current) return;
    if (swipingRef.current && swipeX < -SWIPE_THRESHOLD) {
      onDelete();
    }
    setSwipeX(0);
    touchStartRef.current = null;
    swipingRef.current = false;
  }

  return (
    <div className="relative overflow-hidden">
      {/* Delete zone behind */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end px-4 text-[var(--text-tertiary)] text-[13px] font-medium"
        style={{ width: Math.max(0, -swipeX) }}
      >
        {-swipeX > SWIPE_THRESHOLD / 2 && 'Delete'}
      </div>

      {/* Foreground row */}
      <div
        className={cn(
          'relative row-tight px-3.5 py-1 hover:bg-[var(--bg-hover)] transition-colors',
          !isEditing && 'group'
        )}
        style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Quantity stepper (left of name) */}
        {!isEditing && quantity != null && (
          <div className="shrink-0 flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onQuantityChange(quantity - 1); }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-active)] transition-colors text-sm font-medium"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="min-w-[1.5rem] text-center text-[13px] font-medium text-[var(--text-secondary)] tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onQuantityChange(quantity + 1); }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-active)] transition-colors text-sm font-medium"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        )}

        {isEditing ? (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <input
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
              }}
              onBlur={handleSave}
              placeholder="Qty"
              className="w-14 bg-[var(--bg-elevated)] rounded-[var(--radius-sm)] px-2 py-0.5 text-[13px] text-[var(--text-primary)] text-center outline-none"
              inputMode="numeric"
            />
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
              }}
              onBlur={handleSave}
              className="flex-1 min-w-0 bg-transparent text-[15px] text-[var(--text-primary)] outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartEdit}
            className="flex-1 min-w-0 text-left text-[15px] text-[var(--text-primary)] leading-relaxed cursor-text"
          >
            {text}
          </button>
        )}

        {/* Desktop delete button */}
        {!isEditing && (
          <Tooltip content="Remove item">
            <button
              type="button"
              onClick={onDelete}
              className="shrink-0 p-1 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-all"
              aria-label="Remove item"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function ItemList({ items, binId, readOnly }: ItemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const { showToast } = useToast();
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set(items.map((i) => i.id)));
  const newIds = new Set<string>();
  for (const item of items) {
    if (!knownIdsRef.current.has(item.id)) newIds.add(item.id);
  }
  // Update known IDs after render
  useEffect(() => {
    knownIdsRef.current = new Set(items.map((i) => i.id));
  }, [items]);

  const handleSort = useCallback(async (mode: SortMode) => {
    setSortMode(mode);
    if (mode === 'az' || mode === 'za') {
      const sorted = [...items].sort((a, b) =>
        mode === 'az'
          ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
      );
      try {
        await reorderItems(binId, sorted.map((i) => i.id));
      } catch {
        showToast({ message: 'Failed to sort items', variant: 'error' });
      }
    }
  }, [items, binId, showToast]);

  function cycleSortMode() {
    const next: SortMode = sortMode === 'manual' ? 'az' : sortMode === 'az' ? 'za' : 'manual';
    handleSort(next);
  }

  const [confirmRemove, setConfirmRemove] = useState<{ itemId: string; name: string } | null>(null);

  async function handleSaveEdit(itemId: string, value: string, quantity: number | null) {
    setEditingId(null);
    try {
      await renameItem(binId, itemId, value, quantity);
    } catch {
      showToast({ message: 'Failed to update item', variant: 'error' });
    }
  }

  async function handleQuantityChange(itemId: string, name: string, newQty: number) {
    if (newQty <= 0) {
      setConfirmRemove({ itemId, name });
      return;
    }
    try {
      await updateItemQuantity(binId, itemId, newQty);
    } catch {
      showToast({ message: 'Failed to update quantity', variant: 'error' });
    }
  }

  async function handleConfirmRemove() {
    if (!confirmRemove) return;
    try {
      await updateItemQuantity(binId, confirmRemove.itemId, 0);
    } catch {
      showToast({ message: 'Failed to remove item', variant: 'error' });
    }
    setConfirmRemove(null);
  }

  function handleDelete(itemId: string) {
    setExitingIds((prev) => new Set(prev).add(itemId));
    setTimeout(async () => {
      try {
        await removeItemFromBin(binId, itemId);
      } catch {
        setExitingIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
        showToast({ message: 'Failed to delete item', variant: 'error' });
      }
    }, 200);
  }

  const sortLabel = sortMode === 'az' ? 'A–Z' : sortMode === 'za' ? 'Z–A' : 'Sort';

  return (
    <div>
      <div className="row-spread mb-2 min-h-8">
        <Label>{items.length} {items.length === 1 ? 'Item' : 'Items'}</Label>
        {!readOnly && items.length >= 2 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={cycleSortMode}
            className="shrink-0 gap-1.5 h-8 px-3"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="text-[13px]">{sortLabel}</span>
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-[15px] text-[var(--text-tertiary)] italic">No items yet</p>
      ) : (
        <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] overflow-hidden">
          {items.map((item, i) => readOnly ? (
            <div key={item.id}>
              {i > 0 && <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />}
              <div className="row-tight px-3.5 py-1">
                {item.quantity != null && (
                  <span className="shrink-0 text-[13px] text-[var(--text-tertiary)] tabular-nums">
                    ×{item.quantity}
                  </span>
                )}
                <span className="flex-1 min-w-0 text-[15px] text-[var(--text-primary)] leading-relaxed">
                  {item.name}
                </span>
              </div>
            </div>
          ) : (
            <div key={item.id}>
              {i > 0 && <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />}
              <div
                className={cn(
                  exitingIds.has(item.id) && 'animate-shrink-out',
                )}
              >
                <ItemRow
                  text={item.name}
                  quantity={item.quantity}
                  isEditing={editingId === item.id}
                  onStartEdit={() => setEditingId(item.id)}
                  onSave={(value, qty) => handleSaveEdit(item.id, value, qty)}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => handleDelete(item.id)}
                  onQuantityChange={(newQty) => handleQuantityChange(item.id, item.name, newQty)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--bg-primary)] rounded-[var(--radius-lg)] p-5 shadow-lg max-w-xs w-full mx-4 space-y-3">
            <p className="text-[15px] text-[var(--text-primary)]">
              Remove <strong>{confirmRemove.name}</strong>?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleConfirmRemove}>Remove</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
