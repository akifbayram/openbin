import { useState, useRef, useCallback } from 'react';
import { X, ArrowUpDown } from 'lucide-react';
import { updateBin } from './useBins';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ItemListProps {
  items: string[];
  binId: string;
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
    <div className="relative overflow-hidden rounded-[var(--radius-sm)]">
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
          'relative flex items-center gap-1.5 bg-[var(--bg-elevated)] px-2 py-1.5 transition-shadow',
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
            autoFocus
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
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 p-1 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-all"
            aria-label="Remove item"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ItemList({ items, binId }: ItemListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const { showToast } = useToast();
  const prevItemsRef = useRef(items);
  prevItemsRef.current = items;

  const persistItems = useCallback(async (newItems: string[]) => {
    try {
      await updateBin(binId, { items: newItems });
    } catch {
      showToast({ message: 'Failed to update items' });
    }
  }, [binId, showToast]);

  function handleSort(mode: SortMode) {
    setSortMode(mode);
    if (mode === 'az' || mode === 'za') {
      const sorted = [...items].sort((a, b) =>
        mode === 'az'
          ? a.localeCompare(b, undefined, { sensitivity: 'base' })
          : b.localeCompare(a, undefined, { sensitivity: 'base' })
      );
      persistItems(sorted);
    }
  }

  function cycleSortMode() {
    const next: SortMode = sortMode === 'manual' ? 'az' : sortMode === 'az' ? 'za' : 'manual';
    handleSort(next);
  }

  function handleSaveEdit(index: number, value: string) {
    setEditingIndex(null);
    const newItems = [...items];
    newItems[index] = value;
    persistItems(newItems);
  }

  function handleDelete(index: number) {
    const newItems = items.filter((_, i) => i !== index);
    persistItems(newItems);
  }

  const sortLabel = sortMode === 'az' ? 'A–Z' : sortMode === 'za' ? 'Z–A' : 'Sort';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>{items.length} {items.length === 1 ? 'Item' : 'Items'}</Label>
        {items.length >= 2 && (
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
        <div className="space-y-0.5">
          {items.map((item, i) => (
            <ItemRow
              key={`${i}-${item}`}
              text={item}
              isEditing={editingIndex === i}
              onStartEdit={() => setEditingIndex(i)}
              onSave={(value) => handleSaveEdit(i, value)}
              onCancel={() => setEditingIndex(null)}
              onDelete={() => handleDelete(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
