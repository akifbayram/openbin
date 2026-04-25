import { cn } from '@/lib/utils';

interface QueueDotsProps {
  /** Total number of groups in the queue. */
  total: number;
  /** Index of the group currently being reviewed (0-based). */
  currentIndex: number;
  /**
   * Count of groups already marked reviewed (status === 'reviewed' upstream).
   * Used to render done state for groups behind AND ahead of the current index
   * when the user has navigated backwards from the summary.
   */
  doneCount: number;
  /** Singular bin term (e.g. "Bin", "Box"). Defaults to "Bin". */
  termBin?: string;
}

/**
 * Compact dot pagination for the multi-bin photo review flow.
 *
 * Each dot represents a group in the queue. Done dots are filled accent
 * circles, the current dot widens to an accent pill (so the indicator does
 * not rely on color alone), pending dots are tertiary-color circles.
 *
 * Returns null when there's only one (or zero) groups — single-bin reviews
 * don't need a queue indicator.
 */
export function QueueDots({ total, currentIndex, doneCount, termBin = 'Bin' }: QueueDotsProps) {
  if (total <= 1) return null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> imposes form-field semantics that don't fit an inline pagination indicator; role=group is the correct ARIA match for a labeled grouping of related visuals
    <span
      role="group"
      className="inline-flex items-center gap-1"
      aria-label={`${termBin} ${currentIndex + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const state = stateForIndex(i, currentIndex, doneCount);
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: dots have no stable identity beyond their position
            key={i}
            data-queue-dot
            data-state={state}
            aria-hidden="true"
            className={cn(
              'h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out',
              state === 'current'
                ? 'w-[18px] bg-[var(--accent)]'
                : 'w-1.5',
              state === 'done' && 'bg-[var(--accent)]',
              state === 'pending' && 'bg-[var(--text-quaternary)]',
            )}
          />
        );
      })}
    </span>
  );
}

function stateForIndex(
  i: number,
  currentIndex: number,
  doneCount: number,
): 'done' | 'current' | 'pending' {
  if (i === currentIndex) return 'current';
  if (i < currentIndex) return 'done';
  // Ahead of current but already reviewed (e.g. user navigated back from summary)
  if (i < doneCount) return 'done';
  return 'pending';
}
