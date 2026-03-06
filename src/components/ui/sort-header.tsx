import { ChevronDown, ChevronUp } from 'lucide-react';

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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.125rem',
        fontSize: '12px',
        fontWeight: 500,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.025em',
        color: active ? undefined : 'var(--text-tertiary)',
        transition: 'color 150ms',
      }}
      className={className}
    >
      {label}
      {active && <Chevron className="h-3 w-3" />}
    </button>
  );
}
