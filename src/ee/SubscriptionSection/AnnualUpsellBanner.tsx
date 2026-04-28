import { ArrowUpRight } from 'lucide-react';
import { CheckoutLink, isSafeCheckoutAction } from '@/lib/checkoutAction';
import { cn, focusRing } from '@/lib/utils';
import type { CheckoutAction } from '@/types';
import { formatPriceCents } from './annualSavings';

interface AnnualUpsellBannerProps {
  savingsCents: number;
  switchAction: CheckoutAction | null;
}

export function AnnualUpsellBanner({ savingsCents, switchAction }: AnnualUpsellBannerProps) {
  if (savingsCents <= 0 || !switchAction || !isSafeCheckoutAction(switchAction)) return null;
  return (
    <div className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] p-3 flex items-center justify-between gap-3">
      <p className="text-sm text-[var(--text-primary)]">
        Save {formatPriceCents(savingsCents)}/year by switching to annual
      </p>
      <CheckoutLink
        action={switchAction}
        target="_blank"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-flat)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors',
          focusRing,
        )}
      >
        Switch to annual
        <ArrowUpRight className="h-3.5 w-3.5" />
      </CheckoutLink>
    </div>
  );
}
