import { cn, pluralize } from './utils';

// Mirror of the server-side weights. Kept as a small duplicate (instead
// of a shared package) because the cost is ~10 lines of arithmetic and
// adding a workspace package would dwarf the savings. If you change a
// value here, change the matching constant in
// `server/src/lib/aiCreditWeights.ts` too — the UI hint and the actual
// debit must agree.
const PER_PHOTO = 5;
const PER_BIN = 2;

export function visionWeight(imageCount: number): number {
  const n = Math.max(1, Math.ceil(imageCount));
  return PER_PHOTO * n;
}

export function reorganizeWeight(binCount: number): number {
  const n = Math.max(0, Math.ceil(binCount));
  return PER_BIN * n;
}

interface CreditCostProps {
  cost: number;
  className?: string;
}

export function CreditCost({ cost, className }: CreditCostProps): JSX.Element | null {
  if (cost <= 0) return null;
  return (
    <span className={cn('text-xs text-zinc-500 dark:text-zinc-400', className)}>
      Uses {pluralize(cost, 'credit')}
    </span>
  );
}
