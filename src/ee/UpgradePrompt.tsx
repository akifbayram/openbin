import { ArrowUpRight } from 'lucide-react';
import { CheckoutLink, isSafeCheckoutAction } from '@/lib/checkoutAction';
import { usePlan } from '@/lib/usePlan';
import { cn, focusRing } from '@/lib/utils';
import type { CheckoutAction } from '@/types';

interface UpgradePromptProps {
  feature: string; // e.g. "AI Features", "API Keys"
  description?: string; // Optional explanation
  // Pass the structured CheckoutAction from `planInfo.upgradeAction` (or
  // `upgradeProAction` etc.). Renders a form-POST when the underlying action
  // is POST so the JWT lands in the request body, not the URL.
  upgradeAction: CheckoutAction | null;
  className?: string;
}

export function UpgradePrompt({ feature, description, upgradeAction, className }: UpgradePromptProps) {
  const { isFree, isPlus, isLocked } = usePlan();
  const isActiveFreeOrPlus = (isFree || isPlus) && !isLocked;

  return (
    <div className={cn(
      'flat-card rounded-[var(--radius-lg)] flex items-center justify-between gap-4 px-5 py-4',
      className
    )}>
      <div>
        <p className="text-[15px] font-semibold text-[var(--text-primary)]">
          {isActiveFreeOrPlus
            ? `Upgrade to Pro to unlock ${feature}`
            : `${feature} requires a Pro plan`}
        </p>
        {description && (
          <p className="text-[13px] text-[var(--text-tertiary)] mt-1">{description}</p>
        )}
      </div>
      {isSafeCheckoutAction(upgradeAction) && (
        <CheckoutLink
          action={upgradeAction}
          target="_blank"
          className={cn('inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] h-10 px-4 text-[14px] font-semibold text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] transition-colors shrink-0', focusRing)}
        >
          Upgrade
          <ArrowUpRight className="h-3 w-3" />
        </CheckoutLink>
      )}
    </div>
  );
}
