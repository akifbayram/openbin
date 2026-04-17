import { PackageMinus, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { SearchInput } from '@/components/ui/search-input';
import { type SortDirection, SortHeader } from '@/components/ui/sort-header';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { checkoutItem, returnItem } from '@/features/checkouts/useCheckouts';
import { parseBareQuantity } from '@/lib/itemQuantities';
import { cn, relativeTime, rowAction } from '@/lib/utils';
import type { BinItem, ItemCheckout } from '@/types';
import { ItemListPagination } from './ItemListPagination';
import { removeItemFromBin, renameItem, reorderItems } from './useBins';
import { useItemPageSize } from './useItemPageSize';
import { useItemPagination } from './useItemPagination';

// Filter-search input appears once the bin has more than this many items.
// The page-size preference itself lives in Settings → Preferences → Display.
const FILTER_THRESHOLD = 15;

interface ItemListProps {
  items: BinItem[];
  binId?: string;
  readOnly?: boolean;
  hideWhenEmpty?: boolean;
  hideHeader?: boolean;
  checkouts?: ItemCheckout[];
  onItemsChange?: (items: BinItem[]) => void;
  headerExtra?: React.ReactNode;
  /** Node rendered inside the card below items, separated by a subtle divider.
   *  When set, the card renders even if there are no items (so the slot stays visible). */
  footerSlot?: React.ReactNode;
}

type SortColumn = '' | 'name' | 'qty';

function compareByName(a: BinItem, b: BinItem): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function sortBinItems(items: BinItem[], column: SortColumn, direction: SortDirection): BinItem[] {
  if (column === 'name') {
    return [...items].sort((a, b) => direction === 'asc' ? compareByName(a, b) : -compareByName(a, b));
  }
  if (column === 'qty') {
    return [...items].sort((a, b) => {
      const aNull = a.quantity == null;
      const bNull = b.quantity == null;
      if (aNull && bNull) return compareByName(a, b);
      if (aNull) return 1;
      if (bNull) return -1;
      const qa = a.quantity as number;
      const qb = b.quantity as number;
      const diff = direction === 'desc' ? qb - qa : qa - qb;
      return diff !== 0 ? diff : compareByName(a, b);
    });
  }
  return items;
}

interface ItemRowProps {
  text: string;
  quantity: number | null;
  saved?: boolean;
  checkoutButton?: React.ReactNode;
  onSave: (value: string, quantity: number | null) => void;
  onDelete: () => void;
}

function ItemRow({ text, quantity, saved, checkoutButton, onSave, onDelete }: ItemRowProps) {
  const [editValue, setEditValue] = useState(text);
  const [qtyDraft, setQtyDraft] = useState(quantity != null ? String(quantity) : '');
  // "committed" tracks the last reconciled value — used as the Escape-revert target,
  // the save-diff baseline, and the sentinel for detecting prop changes from the server.
  const committedNameRef = useRef(text);
  const committedQtyRef = useRef(quantity);

  if (text !== committedNameRef.current) {
    committedNameRef.current = text;
    setEditValue(text);
  }
  if (quantity !== committedQtyRef.current) {
    committedQtyRef.current = quantity;
    setQtyDraft(quantity != null ? String(quantity) : '');
  }

  const rowRef = useRef<HTMLDivElement>(null);

  function handleSave() {
    const trimmed = editValue.trim();
    const parsed = parseBareQuantity(qtyDraft);
    const finalQty = parsed != null && parsed >= 1
      ? parsed
      : (qtyDraft.trim() === '' ? null : committedQtyRef.current);
    if (!trimmed) return;
    if (trimmed === committedNameRef.current && finalQty === committedQtyRef.current) return;
    committedNameRef.current = trimmed;
    committedQtyRef.current = finalQty;
    onSave(trimmed, finalQty);
  }

  return (
    <div
      ref={rowRef}
      className={cn(
        'group row-tight px-3.5 py-1 hover:bg-[var(--bg-hover)] transition-colors',
        saved && 'animate-save-flash'
      )}
    >
      <input
        value={qtyDraft}
        onChange={(e) => setQtyDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLElement).blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setQtyDraft(committedQtyRef.current != null ? String(committedQtyRef.current) : '');
            (e.target as HTMLElement).blur();
          }
        }}
        onBlur={() => {
          requestAnimationFrame(() => {
            if (!rowRef.current?.contains(document.activeElement)) handleSave();
          });
        }}
        placeholder="—"
        className={cn(
          'shrink-0 w-8 text-center text-[13px] tabular-nums bg-transparent outline-none focus:text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)]',
          qtyDraft.trim() ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
        )}
        inputMode="numeric"
        aria-label="Quantity"
      />

      <textarea
        rows={1}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            (e.target as HTMLElement).blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditValue(committedNameRef.current);
            (e.target as HTMLElement).blur();
          }
        }}
        onBlur={() => {
          requestAnimationFrame(() => {
            if (!rowRef.current?.contains(document.activeElement)) handleSave();
          });
        }}
        className="flex-1 min-w-0 bg-transparent text-[15px] text-[var(--text-primary)] leading-relaxed outline-none resize-none [field-sizing:content] min-h-[1.5em]"
        aria-label="Item name"
      />

      {checkoutButton}
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
    </div>
  );
}

interface CheckoutRowProps {
  item: BinItem;
  checkout: ItemCheckout;
  canReturn: boolean;
  onReturn: () => void;
}

function CheckoutRow({ item, checkout, canReturn, onReturn }: CheckoutRowProps) {
  return (
    <div className="group row-tight px-3.5 py-1 hover:bg-[var(--bg-hover)] transition-colors">
      <span className="shrink-0 w-8 opacity-50" />
      <span className="flex-1 min-w-0 text-[15px] text-[var(--text-tertiary)] leading-relaxed line-through opacity-50">
        {item.name}
      </span>
      <span className="shrink-0 text-[12px] text-[var(--text-tertiary)] opacity-50">
        Out &middot; {checkout.checked_out_by_name} &middot; {relativeTime(checkout.checked_out_at)}
      </span>
      {canReturn && (
        <Tooltip content="Return item">
          <button
            type="button"
            onClick={onReturn}
            className={rowAction}
            aria-label="Return item"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function ReadOnlyRow({ item }: { item: BinItem }) {
  return (
    <div className="row-tight px-3.5 py-1">
      {item.quantity != null && (
        <span className="shrink-0 w-8 text-center text-[13px] text-[var(--text-primary)] tabular-nums">
          {item.quantity}
        </span>
      )}
      <span className="flex-1 min-w-0 text-[15px] text-[var(--text-primary)] leading-relaxed">
        {item.name}
      </span>
    </div>
  );
}

export function ItemList({ items, binId, readOnly, hideWhenEmpty, hideHeader, checkouts = [], onItemsChange, headerExtra, footerSlot }: ItemListProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { showToast } = useToast();
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const pendingDeletesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const checkoutMap = useMemo(() => {
    const map = new Map<string, ItemCheckout>();
    for (const co of checkouts) map.set(co.item_id, co);
    return map;
  }, [checkouts]);

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const savedTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  function markSaved(itemId: string) {
    setSavedIds(prev => new Set(prev).add(itemId));
    const existing = savedTimersRef.current.get(itemId);
    if (existing) clearTimeout(existing);
    savedTimersRef.current.set(itemId, setTimeout(() => {
      setSavedIds(prev => { const next = new Set(prev); next.delete(itemId); return next; });
      savedTimersRef.current.delete(itemId);
    }, 600));
  }

  // View mode = binId set, parent doesn't control items.
  // Mutations update localItems immediately and persist quietly, skipping the full bin refetch.
  const viewMode = binId != null && !onItemsChange;
  const [localItems, setLocalItems] = useState(items);
  const prevItemsRef = useRef(items);
  if (items !== prevItemsRef.current) {
    prevItemsRef.current = items;
    setLocalItems(items);
  }
  const effectiveItems = viewMode ? localItems : items;

  const reorderTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const displayItems = useMemo(
    () => effectiveItems.filter((item) => !pendingDeleteIds.has(item.id)),
    [effectiveItems, pendingDeleteIds],
  );

  const [filterQuery, setFilterQuery] = useState('');
  const showFilter = displayItems.length > FILTER_THRESHOLD;

  useEffect(() => {
    if (!showFilter) setFilterQuery('');
  }, [showFilter]);

  const filteredItems = useMemo(() => {
    if (!filterQuery) return displayItems;
    const lower = filterQuery.toLowerCase();
    return displayItems.filter((i) => i.name.toLowerCase().includes(lower));
  }, [displayItems, filterQuery]);

  const { pageSize } = useItemPageSize();
  const {
    page,
    setPage,
    totalPages,
    visibleItems,
    rangeStart,
    rangeEnd,
    jumpToLastPage,
  } = useItemPagination(filteredItems, pageSize, [filterQuery, sortColumn, sortDirection, pageSize]);

  // Jump to the last page whenever the upstream `items` count grows (i.e. the
  // parent/server added one). We intentionally watch the raw `items` prop, NOT
  // `effectiveItems` or `displayItems`: (a) adds only arrive via the prop in
  // both form- and view-mode, so `items` is the authoritative signal; (b)
  // `displayItems` grows when a pending delete is undone, and we must NOT jump
  // in that case — the user is actively trying to retrieve something, not add.
  const prevItemsLengthRef = useRef(items.length);
  useEffect(() => {
    if (items.length > prevItemsLengthRef.current) {
      jumpToLastPage();
    }
    prevItemsLengthRef.current = items.length;
  }, [items.length, jumpToLastPage]);

  const onItemsChangeRef = useRef(onItemsChange);
  onItemsChangeRef.current = onItemsChange;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const handleHeaderSort = useCallback((column: string, direction: SortDirection) => {
    if (column !== 'name' && column !== 'qty') return;
    setSortColumn(column);
    setSortDirection(direction);
    const source = viewMode ? localItems : items;
    const sorted = sortBinItems(source, column, direction);
    if (onItemsChange) {
      onItemsChange(sorted);
      return;
    }
    if (!binId) return;
    setLocalItems(sorted);
    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
    reorderTimerRef.current = setTimeout(() => {
      reorderItems(binId, sorted.map((i) => i.id), { quiet: true }).catch(() => {
        showToast({ message: 'Failed to sort items', variant: 'error' });
      });
    }, 500);
  }, [items, localItems, viewMode, binId, onItemsChange, showToast]);

  async function handleSaveEdit(itemId: string, value: string, quantity: number | null) {
    const next = effectiveItems.map((i) => (i.id === itemId ? { ...i, name: value, quantity } : i));
    if (onItemsChange) {
      onItemsChange(next);
      markSaved(itemId);
      return;
    }
    if (!binId) return;
    setLocalItems(next);
    try {
      await renameItem(binId, itemId, value, quantity, { quiet: true });
      markSaved(itemId);
    } catch {
      setLocalItems(items);
      showToast({ message: 'Failed to update item', variant: 'error' });
    }
  }

  function handleDelete(itemId: string) {
    if (pendingDeleteIds.has(itemId)) return;
    setPendingDeleteIds((prev) => new Set(prev).add(itemId));

    const timerId = setTimeout(() => {
      pendingDeletesRef.current.delete(itemId);
      const next = itemsRef.current.filter((i) => i.id !== itemId);
      if (onItemsChangeRef.current) {
        onItemsChangeRef.current(next);
        return;
      }
      setLocalItems(next);
      if (binId) {
        removeItemFromBin(binId, itemId, { quiet: true }).catch(() => {
          setLocalItems(itemsRef.current);
          setPendingDeleteIds((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
          showToast({ message: 'Failed to delete item', variant: 'error' });
        });
      }
    }, 5000);
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

  async function handleCheckout(itemId: string) {
    if (!binId) return;
    try {
      await checkoutItem(binId, itemId);
      showToast({ message: 'Item checked out' });
    } catch {
      showToast({ message: 'Failed to check out item' });
    }
  }

  async function handleReturn(itemId: string) {
    if (!binId) return;
    try {
      await returnItem(binId, itemId);
      showToast({ message: 'Item returned' });
    } catch {
      showToast({ message: 'Failed to return item' });
    }
  }

  useEffect(() => {
    const pending = pendingDeletesRef;
    const saved = savedTimersRef;
    const reorder = reorderTimerRef;
    return () => {
      for (const t of saved.current.values()) clearTimeout(t);
      clearTimeout(reorder.current);

      const entries = [...pending.current.entries()];
      pending.current.clear();
      if (entries.length === 0) return;
      for (const [, timerId] of entries) clearTimeout(timerId);

      const ids = new Set(entries.map(([id]) => id));
      if (onItemsChangeRef.current) {
        onItemsChangeRef.current(itemsRef.current.filter((i) => !ids.has(i.id)));
      } else if (binId) {
        for (const id of ids) {
          removeItemFromBin(binId, id, { quiet: true }).catch(() => {});
        }
      }
    };
  }, [binId]);

  if (hideWhenEmpty && items.length === 0) return null;

  const itemWord = displayItems.length === 1 ? 'Item' : 'Items';
  const headerCount = filterQuery
    ? `${filteredItems.length} of ${displayItems.length} ${itemWord}`
    : `${displayItems.length} ${itemWord}`;
  const showSortHeaders = !readOnly && effectiveItems.length >= 2;
  const showColumnHeader = !readOnly || displayItems.some((item) => item.quantity != null);

  return (
    <div>
      {!hideHeader && (
        <div className="row-spread mb-2 min-h-8">
          <Label>
            {headerCount}
            {checkouts.length > 0 && ` \u00b7 ${checkouts.length} out`}
          </Label>
          {headerExtra && <span className="inline-flex items-center gap-1.5">{headerExtra}</span>}
        </div>
      )}

      {showFilter && (
        <div className="mb-2">
          <SearchInput
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onClear={filterQuery ? () => setFilterQuery('') : undefined}
            placeholder="Filter items..."
          />
        </div>
      )}

      {displayItems.length === 0 && !footerSlot ? (
        <p className="text-[14px] text-[var(--text-tertiary)] py-2">
          {readOnly ? 'No items' : 'No items yet — add one below'}
        </p>
      ) : (
        <div className="rounded-[var(--radius-sm)] bg-[var(--bg-input)] border border-[var(--border-flat)] overflow-hidden">
          {displayItems.length > 0 && showColumnHeader && (
            <div className="row-tight px-3.5 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-hover)]">
              {showSortHeaders ? (
                <>
                  <SortHeader label="Qty" column="qty" currentColumn={sortColumn} currentDirection={sortDirection} onSort={handleHeaderSort} defaultDirection="desc" className="shrink-0 w-8 justify-center" />
                  <SortHeader label="Name" column="name" currentColumn={sortColumn} currentDirection={sortDirection} onSort={handleHeaderSort} className="flex-1" />
                </>
              ) : (
                <>
                  <span className="shrink-0 w-8 text-center text-[12px] font-medium text-[var(--text-tertiary)]">Qty</span>
                  <span className="flex-1 text-[12px] font-medium text-[var(--text-tertiary)]">Name</span>
                </>
              )}
            </div>
          )}
          {displayItems.length > 0 && (
            visibleItems.length === 0 && filterQuery ? (
              <p className="px-3.5 py-3 text-[14px] text-[var(--text-tertiary)] italic">
                No items match &ldquo;{filterQuery}&rdquo;
              </p>
            ) : (
              <div key={page} className="animate-page-enter">
                {visibleItems.map((item, i) => {
                  const checkout = checkoutMap.get(item.id);
                  return (
                    <div key={item.id}>
                      {i > 0 && <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />}
                      {checkout ? (
                        <CheckoutRow
                          item={item}
                          checkout={checkout}
                          canReturn={!readOnly && !!binId}
                          onReturn={() => handleReturn(item.id)}
                        />
                      ) : readOnly ? (
                        <ReadOnlyRow item={item} />
                      ) : (
                        <ItemRow
                          text={item.name}
                          quantity={item.quantity}
                          saved={savedIds.has(item.id)}
                          onSave={(value, qty) => handleSaveEdit(item.id, value, qty)}
                          onDelete={() => handleDelete(item.id)}
                          checkoutButton={binId ? (
                            <Tooltip content="Check out">
                              <button
                                type="button"
                                onClick={() => handleCheckout(item.id)}
                                className={rowAction}
                                aria-label="Check out item"
                              >
                                <PackageMinus className="h-3.5 w-3.5" />
                              </button>
                            </Tooltip>
                          ) : undefined}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
          {footerSlot && (
            <>
              {displayItems.length > 0 && <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />}
              {footerSlot}
            </>
          )}
          <ItemListPagination
            page={page}
            totalPages={totalPages}
            totalCount={filteredItems.length}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
            itemLabel={displayItems.length === 1 ? 'item' : 'items'}
          />
        </div>
      )}
    </div>
  );
}
