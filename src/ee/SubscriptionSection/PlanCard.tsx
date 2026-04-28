import { ArrowUpRight } from 'lucide-react';
import { CheckoutLink, isSafeCheckoutAction } from '@/lib/checkoutAction';
import { cn, focusRing } from '@/lib/utils';
import type { CatalogPlan, CheckoutAction } from '@/types';
import { formatPriceCents } from './annualSavings';

interface PlanCardProps {
  plan: CatalogPlan;
  billingPeriod: 'monthly' | 'annual';
  ctaLabel: string;
  action: CheckoutAction | null;
  isCurrentPlan?: boolean;
  recommended?: boolean;
}

export function PlanCard({ plan, billingPeriod, ctaLabel, action, isCurrentPlan, recommended }: PlanCardProps) {
  const priceCents =
    billingPeriod === 'annual' && plan.prices.annual !== null
      ? Math.round(plan.prices.annual / 12)
      : plan.prices.monthly;

  const periodLabel = billingPeriod === 'annual' ? '/ month, billed yearly' : '/ month';

  const ctaClassName = cn(
    'inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] h-10 px-5 text-[14px] font-semibold text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] transition-colors',
    focusRing,
  );

  return (
    <div className={cn(
      'rounded-[var(--radius-lg)] border p-5 space-y-4',
      recommended && !isCurrentPlan
        ? 'border-[var(--accent)]'
        : 'border-[var(--border-flat)]',
    )}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{plan.name}</h3>
        {isCurrentPlan ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Current plan</span>
        ) : recommended ? (
          <span className="text-xs font-medium text-[var(--accent)]">Popular</span>
        ) : null}
      </div>
      <div>
        <span className="text-3xl font-semibold text-[var(--text-primary)]">{formatPriceCents(priceCents)}</span>
        <span className="text-sm text-[var(--text-tertiary)] ml-1">{periodLabel}</span>
      </div>
      {isCurrentPlan ? (
        <button type="button" disabled className={cn(ctaClassName, 'opacity-50 cursor-not-allowed')}>
          Current plan
        </button>
      ) : action && isSafeCheckoutAction(action) ? (
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
