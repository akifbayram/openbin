import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepDef {
  id: string;
  label: string;
}

interface StepIndicatorProps {
  steps: StepDef[];
  currentStepIndex: number;
  className?: string;
}

function StepIndicator({ steps, currentStepIndex, className }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol className="flex items-start">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const status =
            index < currentStepIndex ? 'complete' : index === currentStepIndex ? 'active' : 'upcoming';

          return (
            <li
              key={step.id}
              className={cn('flex items-start', isLast ? 'shrink-0' : 'flex-1')}
            >
              {/* Circle + label */}
              <div className="flex flex-col items-center shrink-0">
                <span
                  aria-current={status === 'active' ? 'step' : undefined}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold',
                    'transition-[background-color,color,border-color,box-shadow] duration-200 ease-out',
                    status === 'active' &&
                      'bg-[var(--accent)] text-[var(--text-on-accent)] ring-4 ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]',
                    status === 'complete' &&
                      'bg-[var(--accent)] text-[var(--text-on-accent)]',
                    status === 'upcoming' &&
                      'bg-[var(--bg-input)] text-[var(--text-tertiary)] border border-[var(--border-flat)]',
                  )}
                >
                  {status === 'complete' ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} data-testid="step-check" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>

                <span
                  className={cn(
                    'mt-2 text-center text-[11px] leading-tight transition-colors duration-200 ease-out',
                    status === 'active' && 'font-semibold text-[var(--accent)]',
                    status === 'complete' && 'font-medium text-[var(--text-secondary)]',
                    status === 'upcoming' && 'font-normal text-[var(--text-tertiary)]',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecting line — sits at the vertical center of the 28px circle */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={cn(
                    'mt-[13px] mx-2 h-0.5 flex-1 rounded-full transition-colors duration-200 ease-out',
                    status === 'complete'
                      ? 'bg-[var(--accent)]'
                      : 'bg-[var(--border-flat)]',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { StepIndicator };
export type { StepIndicatorProps };
