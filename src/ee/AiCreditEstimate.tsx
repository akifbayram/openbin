import { computeCreditEstimate } from '@/lib/aiCreditCost';
import { usePlan } from '@/lib/usePlan';
import { cn, pluralize } from '@/lib/utils';

interface AiCreditEstimateProps {
  cost: number;
  className?: string;
}

const TONE_CLASSES = {
  neutral: 'text-zinc-500 dark:text-zinc-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
} as const;

export function AiCreditEstimate({ cost, className }: AiCreditEstimateProps) {
  const { planInfo } = usePlan();
  const estimate = computeCreditEstimate(cost, planInfo.aiCredits, planInfo.status);

  if (cost <= 0) return null;

  // No meaningful limit (self-host, Pro/unlimited, Free with no AI):
  // act as a drop-in for <CreditCost> so cloud builds always render
  // the raw cost even when the percent framing would be vacuous.
  if (!estimate) {
    return (
      <span className={cn('text-xs text-zinc-500 dark:text-zinc-400', className)}>
        Uses {pluralize(cost, 'credit')}
      </span>
    );
  }

  const limitLabel = estimate.isTrial ? 'trial credits' : 'monthly limit';
  const summary = estimate.overLimit
    ? `Uses ${pluralize(cost, 'credit')} · would exceed your ${limitLabel}`
    : `Uses ${pluralize(cost, 'credit')} · ${estimate.percent}% of ${limitLabel}`;

  return <span className={cn('text-xs', TONE_CLASSES[estimate.tone], className)}>{summary}</span>;
}
