import { ArrowUpRight, X } from 'lucide-react';
import { CheckoutLink, isSafeCheckoutAction } from '@/lib/checkoutAction';
import { usePlan } from '@/lib/usePlan';
import { useUserPreferences } from '@/lib/userPreferences';
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
  // When set, renders an X dismiss button. Clicking it appends `dismissKey`
  // to the user's `dismissed_upgrade_prompts` preference; the component
  // returns null on subsequent renders for that user.
  dismissKey?: string;
}

export function UpgradePrompt({ feature, description, upgradeAction, className, dismissKey }: UpgradePromptProps) {
  const { isFree, isPlus, isLocked } = usePlan();
  const { preferences, updatePreferences } = useUserPreferences();
  const isActiveFreeOrPlus = (isFree || isPlus) && !isLocked;

  if (dismissKey && preferences.dismissed_upgrade_prompts.includes(dismissKey)) {
    return null;
  }

  function handleDismiss() {
    if (!dismissKey) return;
    updatePreferences((prev) => {
      if (prev.dismissed_upgrade_prompts.includes(dismissKey)) return {};
      return { dismissed_upgrade_prompts: [...prev.dismissed_upgrade_prompts, dismissKey] };
    });
  }

  return (
    <div className={cn(
      'flat-card rounded-[var(--radius-lg)] flex items-center justify-between gap-4 px-5 py-4 relative',
      dismissKey && 'pr-10',
      className,
    )}>
      {dismissKey && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className={cn(
            'absolute top-2 right-2 inline-flex items-center justify-center h-7 w-7 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors',
            focusRing,
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
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
