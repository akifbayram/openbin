import { usePlan } from '@/lib/usePlan';
import { cn, pluralize } from '@/lib/utils';

interface AiCreditEstimateProps {
  cost: number;
  className?: string;
}

export function AiCreditEstimate({ cost, className }: AiCreditEstimateProps) {
  const { planInfo } = usePlan();
  const { aiCredits, status } = planInfo;

  if (cost <= 0) return null;

  // Self-host (aiCredits === null), Pro/unlimited or Free-with-no-AI
  // (limit === 0): the percent framing is meaningless, fall back to the
  // raw "Uses N credits" copy so this component is a drop-in for
  // <CreditCost>.
  if (!aiCredits || aiCredits.limit <= 0) {
    return (
      <span className={cn('text-xs text-zinc-500 dark:text-zinc-400', className)}>
        Uses {pluralize(cost, 'credit')}
      </span>
    );
  }

  const { used, limit } = aiCredits;
  const projected = used + cost;
  const percent = Math.min(100, Math.round((cost / limit) * 100));
  // Trial (Plus only): no monthly reset — `resetsAt` is null even though
  // limit > 0. Use that to switch the copy from "monthly limit" to
  // "trial credits" so the user isn't promised a reset that never comes.
  const isTrial = status === 'trial' || aiCredits.resetsAt === null;
  const limitLabel = isTrial ? 'trial credits' : 'monthly limit';

  const overLimit = projected > limit;
  const nearLimit = !overLimit && projected > limit * 0.8;
  const colorClass = overLimit
    ? 'text-red-600 dark:text-red-400'
    : nearLimit
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-zinc-500 dark:text-zinc-400';

  const summary = overLimit
    ? `Uses ${pluralize(cost, 'credit')} · would exceed your ${limitLabel}`
    : `Uses ${pluralize(cost, 'credit')} · ${percent}% of ${limitLabel}`;

  return <span className={cn('text-xs', colorClass, className)}>{summary}</span>;
}
