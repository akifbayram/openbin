import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, focusRing } from '@/lib/utils';

interface YearChipPagerProps {
  years: number[];
  selected: number | null;
  onSelect: (year: number) => void;
}

const navButton = cn(
  'h-7 w-7 inline-flex items-center justify-center rounded-[var(--radius-xs)]',
  'text-[var(--text-secondary)] hover:bg-[var(--bg-active)] transition-colors',
  'disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-default',
  focusRing,
);

export function YearChipPager({ years, selected, onSelect }: YearChipPagerProps) {
  if (years.length === 0) return null;

  const sorted = [...years].sort((a, b) => a - b);
  const idx = selected != null ? sorted.indexOf(selected) : sorted.length - 1;
  const safeIdx = idx < 0 ? sorted.length - 1 : idx;
  const canPrev = safeIdx > 0;
  const canNext = safeIdx < sorted.length - 1;
  const displayYear = sorted[safeIdx];

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Previous year"
        onClick={() => canPrev && onSelect(sorted[safeIdx - 1])}
        disabled={!canPrev}
        className={navButton}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="min-w-[2.75rem] px-1 text-center text-[13px] font-semibold tabular-nums text-[var(--text-primary)] select-none"
      >
        {displayYear}
      </div>

      <button
        type="button"
        aria-label="Next year"
        onClick={() => canNext && onSelect(sorted[safeIdx + 1])}
        disabled={!canNext}
        className={navButton}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
