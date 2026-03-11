import { ArrowUpDown, Check, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { BinItem } from '@/types';
import { removeItemFromBin, renameItem, reorderItems } from './useBins';

interface ItemListProps {
  items: BinItem[];
  binId: string;
  readOnly?: boolean;
}

type SortMode = 'manual' | 'az' | 'za' | 'qty-desc' | 'qty-asc';

interface ItemRowProps {
  text: string;
  quantity: number | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string, quantity: number | null) => void;
  onCancel: () => void;
  onDelete: () => void;
}

const SWIPE_THRESHOLD = 80;

function ItemRow({ text, quantity, isEditing, onStartEdit, onSave, onCancel, onDelete }: ItemRowProps) {
  const [editValue, setEditValue] = useState(text);
  const [editQuantity, setEditQuantity] = useState<string>(quantity != null ? String(quantity) : '');
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

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
        ref={rowRef}
        className={cn(
          'relative row-tight px-3.5 py-1 hover:bg-[var(--bg-hover)] transition-colors',
          !isEditing && 'group'
        )}
        style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <input
          value={isEditing ? editQuantity : (quantity != null ? String(quantity) : '')}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            if (!isEditing) {
              const num = val === '' ? null : Number.parseInt(val, 10);
              const finalQty = num != null && Number.isFinite(num) && num >= 0 ? num : null;
              onSave(text, finalQty);
            } else {
              setEditQuantity(val);
            }
          }}
          onKeyDown={(e) => {
            if (isEditing) {
              if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
              else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
            }
          }}
          onBlur={isEditing ? () => { requestAnimationFrame(() => { if (!rowRef.current?.contains(document.activeElement)) handleSave(); }); } : undefined}
          placeholder="1"
          className="shrink-0 w-8 text-center text-[13px] tabular-nums text-[var(--text-tertiary)] bg-transparent outline-none focus:text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)]"
          inputMode="numeric"
          aria-label="Quantity"
        />

        {isEditing ? (
          <div className="flex-1 min-w-0">
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
              }}
              onBlur={() => { requestAnimationFrame(() => { if (!rowRef.current?.contains(document.activeElement)) handleSave(); }); }}
              className="w-full bg-transparent text-[15px] text-[var(--text-primary)] leading-relaxed outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onTouchEnd={(e) => { if (!swipingRef.current) { e.preventDefault(); handleStartEdit(); } }}
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
              className="shrink-0 p-1 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity"
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
    if (mode === 'manual') return;
    let sorted: BinItem[];
    if (mode === 'az' || mode === 'za') {
      sorted = [...items].sort((a, b) =>
        mode === 'az'
          ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
      );
    } else {
      sorted = [...items].sort((a, b) => {
        const aNull = a.quantity == null;
        const bNull = b.quantity == null;
        if (aNull && bNull) return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        if (aNull) return 1;
        if (bNull) return -1;
        const diff = mode === 'qty-desc' ? b.quantity! - a.quantity! : a.quantity! - b.quantity!;
        return diff !== 0 ? diff : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    }
    try {
      await reorderItems(binId, sorted.map((i) => i.id));
    } catch {
      showToast({ message: 'Failed to sort items', variant: 'error' });
    }
  }, [items, binId, showToast]);

  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setSortOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => { document.removeEventListener('mousedown', onClickOutside); document.removeEventListener('keydown', onEscape); };
  }, [sortOpen]);

  async function handleSaveEdit(itemId: string, value: string, quantity: number | null) {
    setEditingId(null);
    try {
      await renameItem(binId, itemId, value, quantity);
    } catch {
      showToast({ message: 'Failed to update item', variant: 'error' });
    }
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

  const sortOptions: { key: SortMode; label: string }[] = [
    { key: 'manual', label: 'Default' },
    { key: 'az', label: 'A–Z' },
    { key: 'za', label: 'Z–A' },
    { key: 'qty-desc', label: 'Qty: High → Low' },
    { key: 'qty-asc', label: 'Qty: Low → High' },
  ];
  const sortLabel = sortOptions.find((o) => o.key === sortMode)?.label ?? 'Sort';

  return (
    <div>
      <div className="row-spread mb-2 min-h-8">
        <Label>{items.length} {items.length === 1 ? 'Item' : 'Items'}</Label>
        {!readOnly && items.length >= 2 && (
          <div ref={sortRef} className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSortOpen((o) => !o)}
              className="shrink-0 gap-1.5 h-8 px-3"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="text-[13px]">{sortMode === 'manual' ? 'Sort' : sortLabel}</span>
            </Button>
            {sortOpen && (
              <div className="glass-popover absolute right-0 top-full mt-1 z-20 min-w-[160px] py-1">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { handleSort(opt.key); setSortOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors hover:bg-[var(--bg-hover)]',
                      sortMode === opt.key ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]',
                    )}
                  >
                    <Check className={cn('h-3.5 w-3.5 shrink-0', sortMode === opt.key ? 'opacity-100' : 'opacity-0')} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-[15px] text-[var(--text-tertiary)] italic">No items yet</p>
      ) : (
        <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] overflow-hidden">
          {!readOnly && (
            <div className="row-tight px-3.5 pt-1.5 pb-0.5">
              <span className="shrink-0 w-8 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Qty</span>
              <span className="flex-1 text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Name</span>
            </div>
          )}
          {items.map((item, i) => readOnly ? (
            <div key={item.id}>
              {i > 0 && <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />}
              <div className="row-tight px-3.5 py-1">
                {item.quantity != null && (
                  <span className="shrink-0 text-[13px] text-[var(--text-tertiary)] tabular-nums">
                    {item.quantity}
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
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
