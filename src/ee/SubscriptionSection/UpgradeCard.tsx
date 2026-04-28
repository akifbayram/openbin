import { ArrowUpRight, Check } from 'lucide-react';
import { CheckoutLink, isSafeCheckoutAction } from '@/lib/checkoutAction';
import { cn, focusRing } from '@/lib/utils';
import type { CatalogPlan, CheckoutAction } from '@/types';
import { formatPriceCents } from './annualSavings';

const PRO_HIGHLIGHTS = [
  'API access for integrations',
  'Custom fields & bin sharing',
  'File attachments',
];

interface UpgradeCardProps {
  targetPlan: CatalogPlan;
  action: CheckoutAction | null;
}

export function UpgradeCard({ targetPlan, action }: UpgradeCardProps) {
  const monthly = formatPriceCents(targetPlan.prices.monthly);
  const annual = targetPlan.prices.annual !== null ? formatPriceCents(targetPlan.prices.annual) : null;
  const ctaClassName = cn(
    'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] h-10 px-5 text-[14px] font-semibold text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] transition-colors',
    focusRing,
  );
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-flat)] p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Upgrade to {targetPlan.name}</h3>
        <span className="text-sm text-[var(--text-tertiary)]">
          {monthly}/mo{annual && ` · ${annual}/yr`}
        </span>
      </div>
      <ul className="space-y-1.5">
        {PRO_HIGHLIGHTS.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
            {item}
          </li>
        ))}
      </ul>
      {action && isSafeCheckoutAction(action) && (
        <CheckoutLink action={action} target="_blank" className={ctaClassName}>
          Upgrade to {targetPlan.name}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </CheckoutLink>
      )}
    </div>
  );
}
