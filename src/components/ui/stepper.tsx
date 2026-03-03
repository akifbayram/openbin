import { defineStepper } from '@stepperize/react';
import { Check } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';
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

// Minimal stepper instance shape used by StepperBody.
interface StepperHandle {
  state: { current: { data: { id: string } } };
  navigation: { goTo: (id: string) => void };
}

// Re-type the defineStepper return so that the primitives are JSX-safe.
// The library ships return types that include `bigint`, which React 18 TS
// rejects as a valid JSX element. Casting once here keeps the rest clean.
type StepperKit = {
  Stepper: {
    Root: React.FC<{ initialStep?: string; className?: string; children: ((props: { stepper: StepperHandle }) => ReactNode) | ReactNode }>;
    List: React.FC<{ className?: string; orientation?: string; children?: ReactNode }>;
    Item: React.FC<{ step: string; className?: string; children?: ReactNode }>;
    Trigger: React.FC<{ className?: string; children?: ReactNode }>;
    Separator: React.FC<{ className?: string }>;
    Title: React.FC<{ className?: string; children?: ReactNode }>;
  };
};

/**
 * Presentational horizontal stepper with numbered circles, connecting lines,
 * and labels. Uses @stepperize/react for a11y primitives.
 */
function StepIndicator({ steps, currentStepIndex, className }: StepIndicatorProps) {
  const stepsKey = steps.map((s) => s.id).join(',');

  const { Stepper } = useMemo(() => {
    return defineStepper(...(steps as [StepDef, ...StepDef[]])) as unknown as StepperKit;
  }, [stepsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialStepId = steps[currentStepIndex]?.id ?? steps[0]?.id;

  return (
    <Stepper.Root initialStep={initialStepId} className={cn('w-full', className)}>
      {({ stepper }) => (
        <StepperBody
          steps={steps}
          currentStepIndex={currentStepIndex}
          stepper={stepper}
          Stepper={Stepper}
        />
      )}
    </Stepper.Root>
  );
}

function StepperBody({
  steps,
  currentStepIndex,
  stepper,
  Stepper,
}: {
  steps: StepDef[];
  currentStepIndex: number;
  stepper: StepperHandle;
  Stepper: StepperKit['Stepper'];
}) {
  const prevIndexRef = useRef(currentStepIndex);

  // Sync external currentStepIndex changes with internal stepper state
  useEffect(() => {
    if (prevIndexRef.current !== currentStepIndex) {
      const targetStep = steps[currentStepIndex];
      if (targetStep) {
        stepper.navigation.goTo(targetStep.id);
      }
      prevIndexRef.current = currentStepIndex;
    }
  }, [currentStepIndex, steps, stepper]);

  return (
    <Stepper.List className="flex items-start justify-center gap-0" orientation="horizontal">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const status =
          index < currentStepIndex ? 'success' : index === currentStepIndex ? 'active' : 'inactive';

        return (
          <Stepper.Item
            key={step.id}
            step={step.id}
            className={cn('flex items-start', isLast ? 'flex-shrink-0' : 'flex-1')}
          >
            <div className="flex flex-col items-center">
              <div className="flex w-full items-center">
                <Stepper.Trigger
                  className={cn(
                    'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
                    'border-0 cursor-default outline-none',
                    'transition-all duration-300 ease-out',
                    status === 'active' &&
                      'bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[0_0_12px_var(--accent-glow),0_2px_8px_rgba(0,0,0,0.1)] scale-110',
                    status === 'success' &&
                      'bg-[var(--accent)] text-[var(--text-on-accent)] opacity-70',
                    status === 'inactive' &&
                      'bg-[var(--bg-input)] text-[var(--text-tertiary)] border border-[var(--border-glass)]',
                  )}
                >
                  {status === 'success' ? (
                    <Check className="h-3.5 w-3.5" data-testid="step-check" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </Stepper.Trigger>

                {!isLast && (
                  <Stepper.Separator
                    className={cn(
                      'mx-2 h-px flex-1 border-0 transition-all duration-300 ease-out',
                      status === 'success'
                        ? 'bg-[var(--accent)] opacity-40'
                        : 'bg-[var(--border-glass)]',
                    )}
                  />
                )}
              </div>

              <Stepper.Title
                className={cn(
                  'mt-1.5 text-center text-[11px] leading-tight transition-all duration-300 ease-out',
                  status === 'active' && 'font-semibold text-[var(--accent)]',
                  status === 'success' && 'font-normal text-[var(--text-tertiary)]',
                  status === 'inactive' && 'font-normal text-[var(--text-tertiary)]',
                )}
              >
                {step.label}
              </Stepper.Title>
            </div>
          </Stepper.Item>
        );
      })}
    </Stepper.List>
  );
}

export { StepIndicator };
export type { StepIndicatorProps };
