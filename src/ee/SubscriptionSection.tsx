import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { CheckoutLink } from '@/ee/checkoutAction';
import { SettingsPageHeader } from '@/features/settings/SettingsPageHeader';
import { getLockedCta, getLockedMessage, usePlan } from '@/lib/usePlan';
import { cn, focusRing } from '@/lib/utils';
import type { CatalogPlan, CheckoutAction, PlanTier, PlanUsage } from '@/types';
import { computeAnnualSavings, formatPriceCents } from './SubscriptionSection/annualSavings';
import { CurrentPlanCard } from './SubscriptionSection/CurrentPlanCard';
import { DowngradeImpactDialog } from './SubscriptionSection/DowngradeImpactDialog';
import { formatBillingDate } from './SubscriptionSection/dateHelpers';
import { usePlanCatalog } from './SubscriptionSection/hooks/usePlanCatalog';
import { ManageSubscriptionRow } from './SubscriptionSection/ManageSubscriptionRow';
import { PlanPicker } from './SubscriptionSection/PlanPicker';
import { SupportFooter } from './SubscriptionSection/SupportFooter';
import { UpgradeCard } from './SubscriptionSection/UpgradeCard';

const PAGE_TITLE = 'Subscription';
const PAGE_DESCRIPTION = 'Manage your plan and billing.';

const ZERO_USAGE: PlanUsage = {
  binCount: 0, locationCount: 0, photoStorageMb: 0,
  memberCounts: {},
  viewerCounts: {},
  overLimits: { locations: false, photos: false, members: [] },
};

const downgradeLinkClass = cn(
  'text-sm text-[var(--text-tertiary)] underline hover:text-[var(--text-secondary)] rounded-[var(--radius-xs)]',
  focusRing,
);

const primaryCtaClass = cn(
  'inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] h-10 px-5 text-[14px] font-semibold text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] transition-colors',
  focusRing,
);

interface PrimaryCta {
  label: string;
  action: CheckoutAction;
}

function findPlan(plans: CatalogPlan[], tier: PlanTier): CatalogPlan | undefined {
  return plans.find((p) => p.id === tier);
}

function priceCentsFor(
  plan: CatalogPlan | undefined,
  period: 'monthly' | 'annual' | null,
): number | null {
  if (!plan || !period) return null;
  if (period === 'annual') return plan.prices.annual;
  return plan.prices.monthly;
}

export function SubscriptionSection() {
  const { planInfo, usage, refresh } = usePlan();
  const { plans } = usePlanCatalog();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>(
    planInfo.billingPeriod === 'annual' ? 'annual' : 'monthly',
  );
  const [downgradeTarget, setDowngradeTarget] = useState<'free' | 'plus' | null>(null);

  if (planInfo.selfHosted) return null;

  if (planInfo.locked) {
    const ctaLabel = getLockedCta(planInfo.previousSubStatus);
    const lockedMessage = getLockedMessage(planInfo.previousSubStatus);
    return (
      <>
        <SettingsPageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="settings-section-label">Expired</h3>
            {planInfo.activeUntil && (
              <p className="settings-section-desc mt-1">
                since {formatBillingDate(planInfo.activeUntil)}
              </p>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{lockedMessage}</p>
          {planInfo.subscribePlanAction && (
            <CheckoutLink
              action={planInfo.subscribePlanAction}
              target="_blank"
              className={primaryCtaClass}
            >
              {ctaLabel}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </CheckoutLink>
          )}
          <SupportFooter />
        </div>
      </>
    );
  }

  const plan = planInfo.plan;
  const isPaidActive =
    planInfo.status === 'active' &&
    !!planInfo.activeUntil &&
    (plan === 'plus' || plan === 'pro');
  const isMonthlyPaid = isPaidActive && planInfo.billingPeriod === 'monthly';
  const isCancelPending = !!planInfo.cancelAtPeriodEnd;
  const isTrial = planInfo.status === 'trial';
  const showPicker = plan === 'free' || isTrial;
  const showProUpsell = plan === 'plus' && isPaidActive;
  const showDowngradeLinks = isPaidActive && !isCancelPending;

  const currentCatalogPlan = findPlan(plans, plan);
  const priceCents = priceCentsFor(currentCatalogPlan, planInfo.billingPeriod);
  const monthlyPriceCents = currentCatalogPlan?.prices.monthly ?? null;
  const annualSavings = currentCatalogPlan ? computeAnnualSavings(currentCatalogPlan.prices) : 0;

  // Primary CTA derivation. Trial users get their CTA from the PlanPicker
  // below the card, so no primaryCta in that branch.
  let primaryCta: PrimaryCta | null = null;
  if (
    !isTrial &&
    isCancelPending &&
    planInfo.portalAction
  ) {
    primaryCta = { label: 'Reactivate subscription', action: planInfo.portalAction };
  } else if (
    !isTrial &&
    isMonthlyPaid &&
    annualSavings > 0 &&
    planInfo.portalAction
  ) {
    primaryCta = {
      label: `Switch to annual — save ${formatPriceCents(annualSavings)}/yr`,
      action: planInfo.portalAction,
    };
  }

  // Free + Trial branch: PlanPicker is the primary surface. Trial gets a
  // CurrentPlanCard above it for the countdown.
  if (showPicker) {
    return (
      <>
        <SettingsPageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
        <div className="flex flex-col gap-4">
          {isTrial && (
            <CurrentPlanCard
              plan={plan}
              status={planInfo.status}
              activeUntil={planInfo.activeUntil}
              cancelAtPeriodEnd={planInfo.cancelAtPeriodEnd}
              billingPeriod={planInfo.billingPeriod}
              trialPeriodDays={planInfo.trialPeriodDays}
              priceCents={monthlyPriceCents}
              annualSavingsCents={annualSavings}
              usage={usage ?? ZERO_USAGE}
              features={planInfo.features}
              aiCredits={planInfo.aiCredits}
            />
          )}
          {plans.length > 0 && (
            <PlanPicker
              catalog={{ plans }}
              currentPlan={plan}
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
          {isTrial && (
            <button
              type="button"
              className={cn(downgradeLinkClass, 'block')}
              onClick={() => setDowngradeTarget('free')}
            >
              Switch to Free Plan
            </button>
          )}
          {downgradeTarget && (
            <DowngradeImpactDialog
              open
              onOpenChange={(open) => {
                if (!open) setDowngradeTarget(null);
              }}
              targetPlan={downgradeTarget}
              onConfirmed={() => {
                refresh();
              }}
            />
          )}
          <SupportFooter />
        </div>
      </>
    );
  }

  // Subscribed (active Plus/Pro, possibly cancel-pending)
  const proPlan = showProUpsell ? findPlan(plans, 'pro') : undefined;

  return (
    <>
      <SettingsPageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
      <div className="flex flex-col gap-3">
        <CurrentPlanCard
          plan={plan}
          status={planInfo.status}
          activeUntil={planInfo.activeUntil}
          cancelAtPeriodEnd={planInfo.cancelAtPeriodEnd}
          billingPeriod={planInfo.billingPeriod}
          trialPeriodDays={planInfo.trialPeriodDays}
          priceCents={priceCents}
          annualSavingsCents={annualSavings}
          usage={usage ?? ZERO_USAGE}
          features={planInfo.features}
          aiCredits={planInfo.aiCredits}
        />

        {showProUpsell && proPlan && (
          <UpgradeCard targetPlan={proPlan} action={planInfo.upgradeProAction} />
        )}

        {primaryCta && (
          <CheckoutLink
            action={primaryCta.action}
            target="_blank"
            className={primaryCtaClass}
          >
            {primaryCta.label}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </CheckoutLink>
        )}

        {!isCancelPending && (
          <ManageSubscriptionRow
            action={planInfo.portalAction}
            isCancelPending={isCancelPending}
          />
        )}

        {showDowngradeLinks && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pl-1">
            {plan === 'pro' && (
              <button
                type="button"
                className={downgradeLinkClass}
                onClick={() => setDowngradeTarget('plus')}
              >
                Downgrade to Plus
              </button>
            )}
            {(plan === 'plus' || plan === 'pro') && (
              <button
                type="button"
                className={downgradeLinkClass}
                onClick={() => setDowngradeTarget('free')}
              >
                Switch to Free
              </button>
            )}
          </div>
        )}

        {downgradeTarget && (
          <DowngradeImpactDialog
            open
            onOpenChange={(open) => {
              if (!open) setDowngradeTarget(null);
            }}
            targetPlan={downgradeTarget}
            onConfirmed={() => {
              refresh();
            }}
          />
        )}

        <SupportFooter />
      </div>
    </>
  );
}
