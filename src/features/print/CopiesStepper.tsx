import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopiesStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function CopiesStepper({ label, value, onChange, min = 1, max = 10 }: CopiesStepperProps) {
  return (
    <div className="px-1 pt-3 border-t border-[var(--border-subtle)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Copy className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
          <span className="text-[15px] text-[var(--text-primary)]">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(value - 1)}
            disabled={value <= min}
            className={cn(
              'h-7 w-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[15px] font-medium transition-colors',
              value <= min ? 'text-[var(--text-tertiary)] opacity-40' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
            )}
            aria-label="Decrease copies"
          >
            -
          </button>
          <span className="text-[15px] text-[var(--text-primary)] tabular-nums w-6 text-center">{value}</span>
          <button
            type="button"
            onClick={() => onChange(value + 1)}
            disabled={value >= max}
            className={cn(
              'h-7 w-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[15px] font-medium transition-colors',
              value >= max ? 'text-[var(--text-tertiary)] opacity-40' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
            )}
            aria-label="Increase copies"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
