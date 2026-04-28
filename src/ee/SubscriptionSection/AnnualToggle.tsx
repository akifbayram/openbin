import { cn } from '@/lib/utils';
import { formatPriceCents } from './annualSavings';

interface AnnualToggleProps {
  value: 'monthly' | 'annual';
  onChange: (value: 'monthly' | 'annual') => void;
  /** Best savings across visible plans, in cents/year. Used for the subtitle. */
  maxSavingsCents: number;
}

export function AnnualToggle({ value, onChange, maxSavingsCents }: AnnualToggleProps) {
  return (
    <div className="inline-flex items-center gap-2">
      {maxSavingsCents > 0 && value === 'monthly' && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 mr-1">
          Annual · Save up to {formatPriceCents(maxSavingsCents)}/year
        </span>
      )}
      <div role="radiogroup" className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-flat)] p-0.5">
        {(['monthly', 'annual'] as const).map((period) => (
          // biome-ignore lint/a11y/useSemanticElements: segmented control needs button styling, not native radio
          <button
            key={period}
            type="button"
            role="radio"
            aria-checked={value === period}
            onClick={() => onChange(period)}
            className={cn(
              'px-3 py-1 text-sm rounded-[var(--radius-sm)] transition-colors',
              value === period
                ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                : 'text-[var(--text-tertiary)]',
            )}
          >
            {period === 'monthly' ? 'Monthly' : 'Annual'}
          </button>
        ))}
      </div>
    </div>
  );
}
