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
      <ol className="flex items-start" >
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
                  role="tab"
                  tabIndex={-1}
                  aria-current={status === 'active' ? 'step' : undefined}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold',
                    'transition-all duration-300 ease-out',
                    status === 'active' &&
                      'bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[0_0_12px_var(--accent-glow),0_2px_8px_rgba(0,0,0,0.1)] scale-110',
                    status === 'complete' &&
                      'bg-[var(--accent)] text-[var(--text-on-accent)] opacity-70',
                    status === 'upcoming' &&
                      'bg-[var(--bg-input)] text-[var(--text-tertiary)] border border-[var(--border-glass)]',
                  )}
                >
                  {status === 'complete' ? (
                    <Check className="h-3.5 w-3.5" data-testid="step-check" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>

                <span
                  className={cn(
                    'mt-1.5 text-center text-[11px] leading-tight transition-all duration-300 ease-out',
                    status === 'active' && 'font-semibold text-[var(--accent)]',
                    (status === 'complete' || status === 'upcoming') &&
                      'font-normal text-[var(--text-tertiary)]',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={cn(
                    'mt-[13px] mx-2 h-px flex-1 transition-all duration-300 ease-out',
                    status === 'complete'
                      ? 'bg-[var(--accent)] opacity-40'
                      : 'bg-[var(--border-glass)]',
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
