import { ProgressBar } from '@/components/ui/progress-bar';
import type { PlanFeatures, PlanInfo, PlanTier, PlanUsage, SubscriptionStatus } from '@/types';
import { formatPriceCents } from './annualSavings';
import { daysUntil, formatBillingDate } from './dateHelpers';
import { UsageRow } from './UsageRow';

interface CurrentPlanCardProps {
  plan: PlanTier;
  status: SubscriptionStatus;
  activeUntil: string | null;
  cancelAtPeriodEnd: string | null;
  billingPeriod: 'monthly' | 'annual' | null;
  trialPeriodDays: number;
  priceCents: number | null;
  annualSavingsCents: number;
  usage: PlanUsage;
  features: PlanFeatures;
  aiCredits: PlanInfo['aiCredits'];
}

const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
};

export function CurrentPlanCard(props: CurrentPlanCardProps) {
  const {
    plan, status, activeUntil, cancelAtPeriodEnd, billingPeriod,
    trialPeriodDays, priceCents, annualSavingsCents,
    usage, features, aiCredits,
  } = props;

  const planLabel = PLAN_LABELS[plan];
  const isTrial = status === 'trial';
  const isCancelPending = !!cancelAtPeriodEnd;
  const trialDaysLeft = isTrial ? daysUntil(activeUntil) : null;

  let eyebrow = planLabel.toUpperCase();
  let eyebrowAmber = false;
  let cardAmber = false;
  let title: string;
  let metaLine: string | null = null;
  let bonusLine: string | null = null;

  if (isCancelPending && cancelAtPeriodEnd) {
    eyebrowAmber = true;
    cardAmber = true;
    title = `Cancels ${formatBillingDate(cancelAtPeriodEnd)}`;
    metaLine = `You'll keep ${planLabel} access until then`;
  } else if (isTrial) {
    eyebrow = `${planLabel.toUpperCase()} TRIAL`;
    eyebrowAmber = true;
    title =
      trialDaysLeft === null || trialDaysLeft === 0
        ? 'Trial ended'
        : `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} remaining`;
    metaLine = priceCents !== null ? `Then ${formatPriceCents(priceCents)} / month` : null;
  } else {
    title = 'Active';
    if (activeUntil) {
      const datePart = `Renews ${formatBillingDate(activeUntil)}`;
      const pricePart =
        priceCents !== null && billingPeriod
          ? ` · ${formatPriceCents(priceCents)} / ${billingPeriod === 'annual' ? 'year' : 'month'}`
          : '';
      metaLine = datePart + pricePart;
    }
    if (billingPeriod === 'annual' && annualSavingsCents > 0) {
      bonusLine = `Saving ${formatPriceCents(annualSavingsCents)}/yr on annual billing`;
    }
  }

  const trialBarPct =
    trialDaysLeft !== null && trialPeriodDays > 0
      ? Math.max(0, Math.min(100, ((trialPeriodDays - trialDaysLeft) / trialPeriodDays) * 100))
      : null;
  const trialTone: 'amber' | 'red' =
    trialDaysLeft !== null && trialDaysLeft < 3 ? 'red' : 'amber';

  const eyebrowClass = eyebrowAmber
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-[var(--accent)]';
  const cardClass = cardAmber
    ? 'rounded-[var(--radius-lg)] border border-amber-300 dark:border-amber-700/50 p-4'
    : 'rounded-[var(--radius-lg)] border border-[var(--border-flat)] p-4';

  return (
    <div className={cardClass}>
      <div className={`text-[10px] font-bold tracking-[0.1em] ${eyebrowClass}`}>{eyebrow}</div>
      <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)] mt-1">{title}</h2>
      {metaLine && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{metaLine}</p>}
      {bonusLine && <p className="text-xs text-[var(--accent)] mt-1 font-medium">{bonusLine}</p>}
      {trialBarPct !== null && (
        <ProgressBar
          value={trialBarPct}
          tone={trialTone}
          ariaLabel="Trial progress"
          className="mt-3"
        />
      )}
      <UsageRow usage={usage} features={features} aiCredits={aiCredits} />
    </div>
  );
}
