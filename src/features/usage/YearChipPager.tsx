import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface YearChipPagerProps {
  years: number[];
  selected: number | null;
  onSelect: (year: number) => void;
}

export function YearChipPager({ years, selected, onSelect }: YearChipPagerProps) {
  if (years.length === 0) return null;

  const sorted = [...years].sort((a, b) => a - b);
  const idx = selected != null ? sorted.indexOf(selected) : sorted.length - 1;
  const canPrev = idx > 0;
  const canNext = idx >= 0 && idx < sorted.length - 1;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous year"
        onClick={() => canPrev && onSelect(sorted[idx - 1])}
        disabled={!canPrev}
        className={cn(
          'h-7 w-7 inline-flex items-center justify-center rounded-[var(--radius-xs)]',
          'text-[var(--text-secondary)] hover:bg-[var(--bg-active)]',
          'disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-default',
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex gap-1.5 flex-wrap">
        {sorted.map((year) => {
          const active = year === selected;
          return (
            <button
              key={year}
              type="button"
              onClick={() => onSelect(year)}
              className={cn(
                'px-2.5 py-1 rounded-[var(--radius-xs)] text-[12px] font-semibold',
                'transition-colors',
                active
                  ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                  : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border-flat)] hover:bg-[var(--bg-active)]',
              )}
            >
              {year}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Next year"
        onClick={() => canNext && onSelect(sorted[idx + 1])}
        disabled={!canNext}
        className={cn(
          'h-7 w-7 inline-flex items-center justify-center rounded-[var(--radius-xs)]',
          'text-[var(--text-secondary)] hover:bg-[var(--bg-active)]',
          'disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-default',
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
