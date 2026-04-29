import { ArrowUpRight } from 'lucide-react';
import { CheckoutLink } from '@/ee/checkoutAction';
import { cn, focusRing } from '@/lib/utils';
import type { CheckoutAction } from '@/types';

interface ManageSubscriptionRowProps {
  action: CheckoutAction | null;
  isCancelPending: boolean;
}

export function ManageSubscriptionRow({ action, isCancelPending }: ManageSubscriptionRowProps) {
  if (!action) return null;
  const label = isCancelPending ? 'Reactivate subscription' : 'Manage Subscription';
  return (
    <CheckoutLink
      action={action}
      target="_blank"
      className={cn(
        'inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-flat)] h-10 px-5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors',
        focusRing,
      )}
    >
      {label}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </CheckoutLink>
  );
}
