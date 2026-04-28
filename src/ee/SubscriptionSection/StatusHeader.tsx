import { useMemo } from 'react';
import { ProgressBar } from '@/components/ui/progress-bar';
import type { PlanInfo, PlanTier, SubscriptionStatus } from '@/types';

interface StatusHeaderProps {
  plan: PlanTier;
  status: SubscriptionStatus;
  activeUntil: string | null;
  cancelAtPeriodEnd: string | null;
  previousSubStatus: PlanInfo['previousSubStatus'];
}

const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
};

function formatDate(iso: string): string {
  // Format in UTC so a date-only ISO timestamp (e.g. "2026-05-27T00:00:00Z")
  // renders as the same calendar day regardless of viewer's local timezone.
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 3600 * 1000));
}

export function StatusHeader(props: StatusHeaderProps) {
  const { plan, status, activeUntil, cancelAtPeriodEnd, previousSubStatus } = props;

  const isLapsed = status === 'inactive' && previousSubStatus !== null;
  const isFree = plan === 'free' && !isLapsed;
  const isTrial = status === 'trial';
  const isCancelPending = !!cancelAtPeriodEnd;

  const trialDaysLeft = useMemo(() => (isTrial ? daysUntil(activeUntil) : null), [isTrial, activeUntil]);

  let stateLabel: string;
  let dateLine: string | null = null;

  if (isFree) {
    stateLabel = 'Free Plan';
  } else if (isLapsed) {
    stateLabel = 'Expired';
    dateLine = activeUntil ? `since ${formatDate(activeUntil)}` : null;
  } else if (isTrial) {
    stateLabel = `${PLAN_LABELS[plan]} · Trial · ${trialDaysLeft} days remaining`;
  } else if (isCancelPending && cancelAtPeriodEnd) {
    stateLabel = `${PLAN_LABELS[plan]} · Active`;
    dateLine = `Cancels ${formatDate(cancelAtPeriodEnd)}`;
  } else {
    stateLabel = `${PLAN_LABELS[plan]} · Active`;
    dateLine = activeUntil ? `Renews ${formatDate(activeUntil)}` : null;
  }

  // Trial countdown bar over a default 14-day period.
  const trialBarPct = trialDaysLeft !== null
    ? Math.max(0, Math.min(100, ((14 - trialDaysLeft) / 14) * 100))
    : null;

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{stateLabel}</h2>
      {dateLine && (
        <p className={isCancelPending ? 'text-amber-600 dark:text-amber-400 text-sm' : 'text-[var(--text-tertiary)] text-sm'}>
          {dateLine}
        </p>
      )}
      {trialBarPct !== null && trialDaysLeft !== null && (
        <ProgressBar value={trialBarPct} tone={trialDaysLeft < 3 ? 'red' : 'amber'} ariaLabel="Trial time elapsed" />
      )}
    </div>
  );
}
