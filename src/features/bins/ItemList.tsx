import { ArrowUpDown, Check, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { useClickOutside } from '@/lib/useClickOutside';
import { useMenuKeyboard } from '@/lib/useMenuKeyboard';
import { usePopover } from '@/lib/usePopover';
import { cn, rowAction } from '@/lib/utils';
import type { BinItem } from '@/types';
import { removeItemFromBin, renameItem, reorderItems } from './useBins';
import { useCollapsibleList } from './useCollapsibleList';

interface ItemListProps {
  items: BinItem[];
  binId?: string;
  readOnly?: boolean;
  onItemsChange?: (items: BinItem[]) => void;
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
  const [inlineQty, setInlineQty] = useState(quantity != null ? String(quantity) : '');
  // Sync inline quantity when prop changes (e.g. after server round-trip)
  const prevQty = useRef(quantity);
  if (quantity !== prevQty.current) {
    prevQty.current = quantity;
    setInlineQty(quantity != null ? String(quantity) : '');
  }
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  function handleStartEdit() {
    setEditValue(text);
    setEditQuantity(quantity != null ? String(quantity) : '');
    onStartEdit();
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }
    });
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
        className="absolute inset-y-0 right-0 flex items-center justify-end gap-1.5 px-4 text-white text-[13px] font-medium"
        style={{ width: Math.max(0, -swipeX), backgroundColor: swipeX < 0 ? 'var(--destructive)' : undefined }}
      >
        {-swipeX > SWIPE_THRESHOLD / 2 && (
          <>
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">Delete</span>
          </>
        )}
      </div>

      {/* Foreground row */}
      <div
        ref={rowRef}
        className={cn(
          'relative row-tight px-3.5 py-1 hover:bg-[var(--bg-hover)] transition-colors touch-pan-y',
          !isEditing && 'group'
        )}
        style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <input
          value={isEditing ? editQuantity : inlineQty}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            if (!isEditing) {
              setInlineQty(val);
            } else {
              setEditQuantity(val);
            }
          }}
          onKeyDown={(e) => {
            if (isEditing) {
              if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
              else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
            } else if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLElement).blur();
            }
          }}
          onBlur={isEditing
            ? () => { requestAnimationFrame(() => { if (!rowRef.current?.contains(document.activeElement)) handleSave(); }); }
            : () => {
                const num = inlineQty.trim() === '' ? null : Number.parseInt(inlineQty, 10);
                const finalQty = num != null && Number.isFinite(num) && num >= 0 ? num : null;
                if (finalQty !== quantity) onSave(text, finalQty);
              }
          }
          placeholder="1"
          className="shrink-0 w-8 text-center text-[13px] tabular-nums text-[var(--text-tertiary)] bg-transparent outline-none focus:text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)]"
          inputMode="numeric"
          aria-label="Quantity"
        />

        {isEditing ? (
          <div className="flex-1 min-w-0">
            <textarea
              ref={inputRef}
              rows={1}
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
                else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
              }}
              onBlur={() => { requestAnimationFrame(() => { if (!rowRef.current?.contains(document.activeElement)) handleSave(); }); }}
              className="w-full bg-transparent text-[15px] text-[var(--text-primary)] leading-relaxed outline-none resize-none"
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

        {/* Desktop delete button — spacer preserves row width during edit */}
        {isEditing ? (
          <div className="size-9 shrink-0" />
        ) : (
          <Tooltip content="Remove item">
            <button
              type="button"
              onClick={onDelete}
              className={rowAction}
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

export function ItemList({ items, binId, readOnly, onItemsChange }: ItemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const { showToast } = useToast();
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const pendingDeletesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const displayItems = useMemo(
    () => items.filter((item) => !pendingDeleteIds.has(item.id)),
    [items, pendingDeleteIds],
  );

  const { showFilter, filterQuery, setFilterQuery, filteredCount, visibleIndices, hiddenCount, expand, collapse, canCollapse } =
    useCollapsibleList(displayItems.length, (i) => displayItems[i].name);

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
        const diff = mode === 'qty-desc' ? (b.quantity as number) - (a.quantity as number) : (a.quantity as number) - (b.quantity as number);
        return diff !== 0 ? diff : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    }
    if (onItemsChange) {
      onItemsChange(sorted);
      return;
    }
    try {
      if (!binId) return;
      await reorderItems(binId, sorted.map((i) => i.id));
    } catch {
      showToast({ message: 'Failed to sort items', variant: 'error' });
    }
  }, [items, binId, onItemsChange, showToast]);

  const { visible: sortOpen, animating: sortAnimating, close: sortClose, toggle: sortToggle } = usePopover();
  const sortWrapperRef = useRef<HTMLDivElement>(null);
  useClickOutside(sortWrapperRef, sortClose);
  const { menuRef: sortMenuRef, onKeyDown: sortKeyDown } = useMenuKeyboard(sortOpen, sortClose);

  async function handleSaveEdit(itemId: string, value: string, quantity: number | null) {
    setEditingId(null);
    if (onItemsChange) {
      onItemsChange(items.map((i) => (i.id === itemId ? { ...i, name: value, quantity } : i)));
      return;
    }
    try {
      if (!binId) return;
      await renameItem(binId, itemId, value, quantity);
    } catch {
      showToast({ message: 'Failed to update item', variant: 'error' });
    }
  }

  // Refs so timers and cleanup read current values, not stale closures
  const onItemsChangeRef = useRef(onItemsChange);
  onItemsChangeRef.current = onItemsChange;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  function handleDelete(itemId: string) {
    if (pendingDeleteIds.has(itemId)) return;

    setPendingDeleteIds((prev) => new Set(prev).add(itemId));

    const commitDelete = () => {
      pendingDeletesRef.current.delete(itemId);
      if (onItemsChangeRef.current) {
        onItemsChangeRef.current(itemsRef.current.filter((i) => i.id !== itemId));
      } else {
        if (binId) {
          removeItemFromBin(binId, itemId).catch(() => {
            setPendingDeleteIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
            showToast({ message: 'Failed to delete item', variant: 'error' });
          });
        }
      }
    };

    const timerId = setTimeout(commitDelete, 5000);
    pendingDeletesRef.current.set(itemId, timerId);

    showToast({
      message: 'Item removed',
      duration: 5500,
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = pendingDeletesRef.current.get(itemId);
          if (pending != null) {
            clearTimeout(pending);
            pendingDeletesRef.current.delete(itemId);
            setPendingDeleteIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
          }
        },
      },
    });
  }

  // Flush all pending deletes on unmount (navigation away or edit mode transition)
  useEffect(() => {
    const ref = pendingDeletesRef;
    return () => {
      for (const [itemId, timerId] of ref.current) {
        clearTimeout(timerId);
        if (onItemsChangeRef.current) {
          // handled below in batch
        } else {
          if (binId) removeItemFromBin(binId, itemId).catch(() => {});
        }
      }
      if (onItemsChangeRef.current && ref.current.size > 0) {
        const ids = new Set(ref.current.keys());
        onItemsChangeRef.current(itemsRef.current.filter((i) => !ids.has(i.id)));
      }
      ref.current.clear();
    };
  }, [binId]);

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
        <Label>
          {filterQuery
            ? `${filteredCount} of ${displayItems.length} ${displayItems.length === 1 ? 'Item' : 'Items'}`
            : `${displayItems.length} ${displayItems.length === 1 ? 'Item' : 'Items'}`}
        </Label>
        {!readOnly && items.length >= 2 && (
          <div ref={sortWrapperRef} className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={sortToggle}
              className="shrink-0 gap-1.5 h-8 px-3"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="text-[13px]">{sortMode === 'manual' ? 'Sort' : sortLabel}</span>
            </Button>
            {sortOpen && (
              <div
                ref={sortMenuRef}
                role="menu"
                onKeyDown={sortKeyDown}
                className={cn(
                  sortAnimating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
                  'absolute right-0 mt-1 w-48 rounded-[var(--radius-md)] flat-popover overflow-hidden z-20',
                )}
              >
                {sortOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { handleSort(opt.key); sortClose(); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <Check className={cn('h-4 w-4', sortMode === opt.key ? 'text-[var(--accent)]' : 'invisible')} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showFilter && (
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-quaternary)]" />
          <input
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter items..."
            className="w-full h-8 pl-8 pr-8 rounded-[var(--radius-md)] bg-[var(--bg-input)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              aria-label="Clear filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {displayItems.length === 0 ? (
        <p className="text-[14px] text-[var(--text-tertiary)] py-2">
          {readOnly ? 'No items' : 'No items yet — add one below'}
        </p>
      ) : (
        <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] overflow-hidden">
          {(!readOnly || displayItems.some((item) => item.quantity != null)) && (
            <div className="row-tight px-3.5 pt-1.5 pb-0.5">
              <span className="shrink-0 w-8 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Qty</span>
              <span className="flex-1 text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Name</span>
            </div>
          )}
          {visibleIndices.length === 0 && filterQuery ? (
            <p className="px-3.5 py-3 text-[14px] text-[var(--text-tertiary)] italic">
              No items match &ldquo;{filterQuery}&rdquo;
            </p>
          ) : (
            visibleIndices.map((idx, i) => {
              const item = displayItems[idx];
              return readOnly ? (
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
              );
            })
          )}
          {hiddenCount > 0 && (
            <>
              <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />
              <button
                type="button"
                onClick={expand}
                className="w-full py-2.5 text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Show {hiddenCount} more {hiddenCount === 1 ? 'item' : 'items'}
              </button>
            </>
          )}
          {canCollapse && (
            <>
              <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />
              <button
                type="button"
                onClick={collapse}
                className="w-full py-2.5 text-[13px] font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Show less
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
