import type { CatalogPlan, CheckoutAction, PlanCatalog, PlanTier } from '@/types';
import { AnnualToggle } from './AnnualToggle';
import { computeAnnualSavings } from './annualSavings';
import { PlanCard } from './PlanCard';

interface PlanPickerProps {
  catalog: PlanCatalog;
  currentPlan: PlanTier;
  billingPeriod: 'monthly' | 'annual';
  onBillingPeriodChange: (period: 'monthly' | 'annual') => void;
  actions: {
    plus: CheckoutAction | null;
    pro: CheckoutAction | null;
  };
}

const KEEP_LABEL: Record<PlanTier, Partial<Record<'plus' | 'pro', string>>> = {
  free: { plus: 'Subscribe', pro: 'Subscribe' },
  plus: { plus: 'Subscribe', pro: 'Upgrade' },
  pro: { pro: 'Subscribe' },
};

function ctaFor(currentPlan: PlanTier, plan: CatalogPlan): string {
  return KEEP_LABEL[currentPlan]?.[plan.id as 'plus' | 'pro'] ?? 'Subscribe';
}

export function PlanPicker(props: PlanPickerProps) {
  const { catalog, currentPlan, billingPeriod, onBillingPeriodChange, actions } = props;

  const upgradePlans = catalog.plans.filter((p) => p.id !== 'free');
  const maxSavings = Math.max(...upgradePlans.map((p) => computeAnnualSavings(p.prices)));

  const actionFor = (plan: CatalogPlan): CheckoutAction | null => {
    if (plan.id === 'plus') return actions.plus;
    if (plan.id === 'pro') return actions.pro;
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AnnualToggle
          value={billingPeriod}
          onChange={onBillingPeriodChange}
          maxSavingsCents={maxSavings}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {upgradePlans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            billingPeriod={billingPeriod}
            ctaLabel={ctaFor(currentPlan, plan)}
            action={actionFor(plan)}
            isCurrentPlan={plan.id === currentPlan}
          />
        ))}
      </div>
      <div className="text-center">
        <a
          href="https://openbin.app/plans"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--text-tertiary)] underline hover:text-[var(--text-secondary)]"
        >
          Compare features →
        </a>
      </div>
    </div>
  );
}
