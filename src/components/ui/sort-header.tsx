import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

interface SortHeaderProps<C extends string> {
  label: string;
  column: C;
  currentColumn: C;
  currentDirection: SortDirection;
  onSort: (column: C, direction: SortDirection) => void;
  defaultDirection?: SortDirection;
  className?: string;
}

export function SortHeader<C extends string>({
  label,
  column,
  currentColumn,
  currentDirection,
  onSort,
  defaultDirection = 'asc',
  className,
}: SortHeaderProps<C>) {
  const active = currentColumn === column;
  const Chevron = active && currentDirection === 'desc' ? ChevronDown : ChevronUp;

  function handleClick() {
    if (active) {
      onSort(column, currentDirection === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(column, defaultDirection);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex items-center gap-0.5 text-[12px] font-medium uppercase tracking-wide transition-colors',
        active ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
        className,
      )}
    >
      {label}
      {active && <Chevron className="h-3 w-3" />}
    </button>
  );
}
