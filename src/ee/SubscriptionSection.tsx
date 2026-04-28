import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { CheckoutLink, isSafeCheckoutAction } from '@/lib/checkoutAction';
import { getLockedCta, getLockedMessage, usePlan } from '@/lib/usePlan';
import { cn, focusRing } from '@/lib/utils';
import type { PlanTier, PlanUsage } from '@/types';
import { AnnualUpsellBanner } from './SubscriptionSection/AnnualUpsellBanner';
import { computeAnnualSavings } from './SubscriptionSection/annualSavings';
import { DowngradeImpactDialog } from './SubscriptionSection/DowngradeImpactDialog';
import { usePlanCatalog } from './SubscriptionSection/hooks/usePlanCatalog';
import { ManageSubscriptionRow } from './SubscriptionSection/ManageSubscriptionRow';
import { PlanPicker } from './SubscriptionSection/PlanPicker';
import { StatusHeader } from './SubscriptionSection/StatusHeader';
import { SupportFooter } from './SubscriptionSection/SupportFooter';
import { UpgradeCard } from './SubscriptionSection/UpgradeCard';
import { UsageStrip } from './SubscriptionSection/UsageStrip';

const ZERO_USAGE: PlanUsage = {
  binCount: 0, locationCount: 0, photoStorageMb: 0,
  memberCounts: {},
  overLimits: { locations: false, photos: false, members: [] },
};

const downgradeLinkClass = cn(
  'text-sm text-[var(--text-tertiary)] underline block hover:text-[var(--text-secondary)] rounded-[var(--radius-xs)]',
  focusRing,
);

export function SubscriptionSection() {
  const { planInfo, usage, refresh } = usePlan();
  const { plans } = usePlanCatalog();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>(
    planInfo.billingPeriod === 'annual' ? 'annual' : 'monthly',
  );
  const [downgradeTarget, setDowngradeTarget] = useState<'free' | 'plus' | null>(null);

  // Self-hosted gate: page is cloud-only. Self-hosted users render nothing
  // (the Settings route should already be hidden, but defense-in-depth here.)
  if (planInfo.selfHosted) return null;

  if (planInfo.locked) {
    const ctaLabel = getLockedCta(planInfo.previousSubStatus);
    const lockedMessage = getLockedMessage(planInfo.previousSubStatus);
    const ctaClassName = cn(
      'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] h-10 px-5 text-[14px] font-semibold text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] transition-colors',
      focusRing,
    );
    return (
      <div className="space-y-4">
        <StatusHeader
          plan={planInfo.plan}
          status={planInfo.status}
          activeUntil={planInfo.activeUntil}
          cancelAtPeriodEnd={planInfo.cancelAtPeriodEnd}
          previousSubStatus={planInfo.previousSubStatus}
          trialPeriodDays={planInfo.trialPeriodDays}
        />
        <p className="text-sm text-[var(--text-secondary)]">{lockedMessage}</p>
        {planInfo.subscribePlanAction && isSafeCheckoutAction(planInfo.subscribePlanAction) && (
          <CheckoutLink action={planInfo.subscribePlanAction} target="_blank" className={ctaClassName}>
            {ctaLabel}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </CheckoutLink>
        )}
        <SupportFooter />
      </div>
    );
  }

  const isPaidActive = planInfo.status === 'active' && !!planInfo.activeUntil && (planInfo.plan === 'plus' || planInfo.plan === 'pro');
  const isMonthlyPaid = isPaidActive && planInfo.billingPeriod === 'monthly';
  const isCancelPending = !!planInfo.cancelAtPeriodEnd;
  const isTrial = planInfo.status === 'trial';
  const showAnnualUpsell = isMonthlyPaid && !isCancelPending;
  const showPicker = planInfo.plan === 'free' || isTrial;
  const showProUpsell = planInfo.plan === 'plus' && isPaidActive;

  const proPlan = plans.find(p => p.id === 'pro');
  const plusPlan = plans.find(p => p.id === 'plus');
  const currentSavings = isMonthlyPaid && planInfo.plan === 'plus' && plusPlan
    ? computeAnnualSavings(plusPlan.prices)
    : isMonthlyPaid && planInfo.plan === 'pro' && proPlan
      ? computeAnnualSavings(proPlan.prices)
      : 0;

  const showDowngradeLinks = isPaidActive && !isCancelPending;

  return (
    <div className="space-y-6">
      {/* Status + usage — tightly grouped */}
      <div className="space-y-3">
        <StatusHeader
          plan={planInfo.plan}
          status={planInfo.status}
          activeUntil={planInfo.activeUntil}
          cancelAtPeriodEnd={planInfo.cancelAtPeriodEnd}
          previousSubStatus={planInfo.previousSubStatus}
          trialPeriodDays={planInfo.trialPeriodDays}
        />
        <UsageStrip usage={usage ?? ZERO_USAGE} features={planInfo.features} aiCredits={planInfo.aiCredits} />
      </div>

      {showAnnualUpsell && (
        <AnnualUpsellBanner savingsCents={currentSavings} switchAction={planInfo.portalAction} />
      )}

      {showPicker && plans.length > 0 && (
        <PlanPicker
          catalog={{ plans }}
          currentPlan={planInfo.plan as PlanTier}
          billingPeriod={billingPeriod}
          onBillingPeriodChange={setBillingPeriod}
          actions={{
            plus: planInfo.upgradePlusAction,
            pro: planInfo.upgradeProAction,
          }}
        />
      )}

      {isTrial && (
        <p className="text-sm text-[var(--text-tertiary)] text-center">
          Cancel anytime · No questions asked
        </p>
      )}

      {showProUpsell && proPlan && (
        <UpgradeCard targetPlan={proPlan} action={planInfo.upgradeProAction} />
      )}

      {isPaidActive && (
        <ManageSubscriptionRow action={planInfo.portalAction} isCancelPending={isCancelPending} />
      )}

      {showDowngradeLinks && (
        <div className="space-y-2">
          {planInfo.plan === 'pro' && (
            <button type="button" className={downgradeLinkClass} onClick={() => setDowngradeTarget('plus')}>
              Downgrade to Plus
            </button>
          )}
          {(planInfo.plan === 'plus' || planInfo.plan === 'pro') && (
            <button type="button" className={downgradeLinkClass} onClick={() => setDowngradeTarget('free')}>
              Switch to Free Plan
            </button>
          )}
        </div>
      )}

      {isTrial && (
        <button type="button" className={downgradeLinkClass} onClick={() => setDowngradeTarget('free')}>
          Switch to Free Plan
        </button>
      )}

      {downgradeTarget && (
        <DowngradeImpactDialog
          open={true}
          onOpenChange={open => { if (!open) setDowngradeTarget(null); }}
          targetPlan={downgradeTarget}
          onConfirmed={() => { refresh(); }}
        />
      )}

      <SupportFooter />
    </div>
  );
}
