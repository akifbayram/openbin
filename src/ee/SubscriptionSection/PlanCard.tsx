import { ArrowUpRight } from 'lucide-react';
import { CheckoutLink } from '@/ee/checkoutAction';
import { cn, focusRing } from '@/lib/utils';
import type { CatalogPlan, CheckoutAction } from '@/types';
import { formatPriceCents } from './annualSavings';

interface PlanCardProps {
  plan: CatalogPlan;
  billingPeriod: 'quarterly' | 'annual';
  ctaLabel: string;
  action: CheckoutAction | null;
  isCurrentPlan?: boolean;
}

export function PlanCard({ plan, billingPeriod, ctaLabel, action, isCurrentPlan }: PlanCardProps) {
  const priceCents =
    billingPeriod === 'annual' && plan.prices.annual !== null
      ? Math.round(plan.prices.annual / 12)
      : plan.prices.quarterly;

  const periodLabel = billingPeriod === 'annual' ? '/ month, billed yearly' : '/ quarter';

  const ctaClassName = cn(
    'inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] h-10 px-5 text-[14px] font-semibold text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] transition-colors',
    focusRing,
  );

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-flat)] p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{plan.name}</h3>
        {isCurrentPlan && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Current plan</span>
        )}
      </div>
      <div>
        <span className="text-3xl font-semibold text-[var(--text-primary)]">{formatPriceCents(priceCents)}</span>
        <span className="text-sm text-[var(--text-tertiary)] ml-1">{periodLabel}</span>
      </div>
      {isCurrentPlan ? (
        <button type="button" disabled className={cn(ctaClassName, 'opacity-50 cursor-not-allowed')}>
          Current plan
        </button>
      ) : action ? (
        <CheckoutLink action={action} target="_blank" className={ctaClassName}>
          {ctaLabel}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </CheckoutLink>
      ) : (
        <button type="button" disabled className={cn(ctaClassName, 'opacity-50 cursor-not-allowed')}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
