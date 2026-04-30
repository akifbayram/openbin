import { cn } from '@/lib/utils';
import { formatPriceCents } from './annualSavings';

interface BillingPeriodToggleProps {
  value: 'quarterly' | 'annual';
  onChange: (value: 'quarterly' | 'annual') => void;
  /** Best savings across visible plans, in cents/year. Used for the subtitle. */
  maxSavingsCents: number;
}

export function BillingPeriodToggle({ value, onChange, maxSavingsCents }: BillingPeriodToggleProps) {
  return (
    <div className="inline-flex items-center gap-2">
      {maxSavingsCents > 0 && value === 'quarterly' && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 mr-1">
          Annual · Save up to {formatPriceCents(maxSavingsCents)}/year
        </span>
      )}
      <div role="radiogroup" className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-flat)] p-0.5">
        {(['quarterly', 'annual'] as const).map((period) => (
          // biome-ignore lint/a11y/useSemanticElements: segmented control needs button styling, not native radio
          <button
            key={period}
            type="button"
            role="radio"
            aria-checked={value === period}
            onClick={() => onChange(period)}
            className={cn(
              'min-h-9 px-3 py-1.5 text-sm rounded-[var(--radius-sm)] transition-colors',
              value === period
                ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                : 'text-[var(--text-tertiary)]',
            )}
          >
            {period === 'quarterly' ? 'Quarterly' : 'Annual'}
          </button>
        ))}
      </div>
    </div>
  );
}
