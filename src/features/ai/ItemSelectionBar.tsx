import { PackageMinus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, flatCard } from '@/lib/utils';

interface ItemSelectionBarProps {
  selectionCount: number;
  onCheckout: () => void;
  onRemove: () => void;
  onClear: () => void;
  isBusy?: boolean;
}

export function ItemSelectionBar({
  selectionCount,
  onCheckout,
  onRemove,
  onClear,
  isBusy,
}: ItemSelectionBarProps) {
  if (selectionCount === 0) return null;
  return (
    <section
      aria-label="Bulk actions"
      aria-live="polite"
      className={cn(
        flatCard,
        'sticky bottom-2 mt-3 px-3 py-2 flex items-center gap-2 rounded-[var(--radius-md)]',
      )}
    >
      <span className="text-[13px] text-[var(--text-primary)]">
        {selectionCount} {selectionCount === 1 ? 'item' : 'items'} selected
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-[var(--radius-xs)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)]"
      >
        <X className="h-4 w-4" />
      </button>
      <span className="flex-1" />
      <Button size="sm" variant="secondary" onClick={onCheckout} disabled={isBusy}>
        <PackageMinus className="h-4 w-4 mr-1" /> Checkout
      </Button>
      <Button size="sm" variant="destructive" onClick={onRemove} disabled={isBusy}>
        <Trash2 className="h-4 w-4 mr-1" /> Remove
      </Button>
    </section>
  );
}
