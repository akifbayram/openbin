import { ArrowUpDown, X } from 'lucide-react';
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

type SortMode = 'manual' | 'az' | 'za';

interface ItemRowProps {
  text: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}

const SWIPE_THRESHOLD = 80;

function ItemRow({ text, isEditing, onStartEdit, onSave, onCancel, onDelete }: ItemRowProps) {
  const [editValue, setEditValue] = useState(text);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleStartEdit() {
    setEditValue(text);
    onStartEdit();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== text) {
      onSave(trimmed);
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
          'relative flex items-center gap-1.5 px-3.5 py-1 hover:bg-[var(--bg-hover)] transition-colors',
          !isEditing && 'group'
        )}
        style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
            onBlur={handleSave}
            className="flex-1 min-w-0 bg-transparent text-[15px] text-[var(--text-primary)] outline-none py-0.5"
          />
        ) : (
          <button
            type="button"
            onClick={handleStartEdit}
            className="flex-1 min-w-0 text-left text-[15px] text-[var(--text-primary)] leading-relaxed py-0.5 cursor-text"
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
        showToast({ message: 'Failed to sort items' });
      }
    }
  }, [items, binId, showToast]);

  function cycleSortMode() {
    const next: SortMode = sortMode === 'manual' ? 'az' : sortMode === 'az' ? 'za' : 'manual';
    handleSort(next);
  }

  async function handleSaveEdit(itemId: string, value: string) {
    setEditingId(null);
    try {
      await renameItem(binId, itemId, value);
    } catch {
      showToast({ message: 'Failed to rename item' });
    }
  }

  function handleDelete(itemId: string) {
    setExitingIds((prev) => new Set(prev).add(itemId));
    setTimeout(async () => {
      try {
        await removeItemFromBin(binId, itemId);
      } catch {
        setExitingIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
        showToast({ message: 'Failed to delete item' });
      }
    }, 200);
  }

  const sortLabel = sortMode === 'az' ? 'A–Z' : sortMode === 'za' ? 'Z–A' : 'Sort';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>{items.length} {items.length === 1 ? 'Item' : 'Items'}</Label>
        {!readOnly && items.length >= 2 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={cycleSortMode}
            className="shrink-0 rounded-[var(--radius-full)] gap-1.5 h-8 px-3"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="text-[13px]">{sortLabel}</span>
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-[15px] text-[var(--text-tertiary)] italic">No items yet</p>
      ) : (
        <div className="rounded-[var(--radius-sm)] bg-[var(--bg-input)] overflow-hidden">
          {items.map((item, i) => readOnly ? (
            <div key={item.id}>
              {i > 0 && <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1',
                  newIds.has(item.id) && 'animate-fade-in-up',
                )}
              >
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
                  newIds.has(item.id) && !exitingIds.has(item.id) && 'animate-fade-in-up',
                )}
              >
                <ItemRow
                  text={item.name}
                  isEditing={editingId === item.id}
                  onStartEdit={() => setEditingId(item.id)}
                  onSave={(value) => handleSaveEdit(item.id, value)}
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
