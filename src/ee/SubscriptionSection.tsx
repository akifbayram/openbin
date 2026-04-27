import { AlertTriangle, ArrowUpRight, Check, Clock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { SettingsPageHeader } from '@/features/settings/SettingsPageHeader';
import { SettingsRow } from '@/features/settings/SettingsRow';
import { SettingsSection } from '@/features/settings/SettingsSection';
import { apiFetch } from '@/lib/api';
import { CheckoutLink, isSafeCheckoutAction, submitCheckoutAction } from '@/lib/checkoutAction';
import { getLockedCta, getLockedMessage, usePlan } from '@/lib/usePlan';
import { cn, focusRing, plural } from '@/lib/utils';
import type { CheckoutAction, PlanFeatures, PlanTier } from '@/types';

// ── Constants ────────────────────────────────────────────────────────

const NEAR_LIMIT_THRESHOLD = 0.8;

const actionBase = cn(
  'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] h-10 px-5 text-[14px] font-semibold transition-colors',
  focusRing,
);
const actionPrimary = cn(actionBase, 'bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)]');
const actionSecondary = cn(actionBase, 'border border-[var(--border-flat)] bg-[var(--bg-input)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]');

// ── Pure helpers ─────────────────────────────────────────────────────

interface UsageTile {
  label: string;
  sublabel?: string;
  used: number | string;
  limit: number | string;
  isOver?: boolean;
  isExhausted?: boolean;
}

function buildUsageTiles(
  planInfo: ReturnType<typeof usePlan>['planInfo'],
  usage: ReturnType<typeof usePlan>['usage'],
): UsageTile[] {
  const { features, aiCredits } = planInfo;
  const tiles: UsageTile[] = [];

  if (features.maxBins !== null && usage) {
    tiles.push({
      label: 'Bins',
      used: usage.binCount,
      limit: features.maxBins,
      isOver: usage.binCount > features.maxBins,
    });
  }

  if (aiCredits && aiCredits.limit > 0) {
    const resetsLabel = aiCredits.resetsAt
      ? new Date(aiCredits.resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null;
    tiles.push({
      label: 'AI Credits',
      sublabel: resetsLabel ? `Resets ${resetsLabel}` : undefined,
      used: aiCredits.used,
      limit: aiCredits.limit,
      isExhausted: aiCredits.used >= aiCredits.limit,
    });
  }

  if (features.maxPhotoStorageMb !== null && usage) {
    tiles.push({
      label: 'Photos',
      used: `${usage.photoStorageMb.toFixed(1)} MB`,
      limit: features.maxPhotoStorageMb >= 1024
        ? `${(features.maxPhotoStorageMb / 1024).toFixed(0)} GB`
        : `${features.maxPhotoStorageMb} MB`,
      isOver: usage.photoStorageMb > features.maxPhotoStorageMb,
    });
  }

  if (features.maxLocations !== null && usage) {
    tiles.push({
      label: 'Locations',
      used: usage.locationCount,
      limit: features.maxLocations,
      isOver: usage.locationCount > features.maxLocations,
    });
  }

  if (features.maxMembersPerLocation !== null && usage) {
    const maxMembers = Math.max(0, ...Object.values(usage.memberCounts));
    tiles.push({
      label: 'Members',
      used: maxMembers,
      limit: features.maxMembersPerLocation,
      isOver: maxMembers > features.maxMembersPerLocation,
    });
  }

  return tiles;
}

function isNearLimit(tile: UsageTile): boolean {
  if (tile.isOver || tile.isExhausted) return true;
  if (typeof tile.used !== 'number' || typeof tile.limit !== 'number') return false;
  if (tile.limit <= 1) return false;
  return tile.used / tile.limit >= NEAR_LIMIT_THRESHOLD;
}

const PLUS_FEATURES: Array<{ key: keyof PlanFeatures; label: string }> = [
  { key: 'maxBins', label: 'Up to 100 bins' },
  { key: 'reorganize', label: 'AI reorganization' },
  { key: 'fullExport', label: 'Full data export' },
];

const PRO_FEATURES: Array<{ key: keyof PlanFeatures; label: string }> = [
  { key: 'maxBins', label: 'Up to 1,000 bins' },
  { key: 'customFields', label: 'Custom fields' },
  { key: 'apiKeys', label: 'API keys' },
  { key: 'binSharing', label: 'Bin sharing links' },
  { key: 'maxLocations', label: 'Up to 10 locations' },
];

function getNextTierFeatures(plan: PlanTier, features: PlanFeatures): string[] {
  const list = plan === 'free' ? PLUS_FEATURES : PRO_FEATURES;
  return list
    .filter(({ key }) => {
      const val = features[key];
      if (typeof val === 'boolean') return !val;
      if (typeof val === 'number') return true;
      return false;
    })
    .map(({ label }) => label);
}

function getPlanSubtitle(plan: PlanTier, features: PlanFeatures): string {
  if (plan === 'pro') return 'Unlimited · All features';
  if (plan === 'plus') {
    const parts: string[] = [];
    if (features.maxBins !== null) parts.push(`${features.maxBins} bins`);
    if (features.ai) parts.push('AI credits');
    if (features.customFields) parts.push('Custom fields');
    return parts.join(' · ') || 'Plus features';
  }
  const parts: string[] = [];
  if (features.maxBins !== null) parts.push(`${features.maxBins} bins`);
  if (features.maxLocations !== null) parts.push(`${features.maxLocations} location${features.maxLocations !== 1 ? 's' : ''}`);
  return parts.join(' · ') || 'Basic features';
}

function getPrimaryCta(
  planInfo: ReturnType<typeof usePlan>['planInfo'],
  isLocked: boolean,
): { label: string; action: CheckoutAction } | null {
  if (isLocked) {
    const label = getLockedCta(planInfo.previousSubStatus);
    const action = planInfo.subscribePlanAction ?? planInfo.upgradeAction;
    if (isSafeCheckoutAction(action)) return { label, action };
    return null;
  }

  const isTrialing = planInfo.status === 'trial';

  if (planInfo.plan === 'free' && isSafeCheckoutAction(planInfo.upgradeAction)) {
    return { label: 'Upgrade', action: planInfo.upgradeAction };
  }

  if (isTrialing && isSafeCheckoutAction(planInfo.subscribePlanAction)) {
    const planName = planInfo.plan === 'plus' ? 'Plus' : 'Pro';
    return { label: `Subscribe to ${planName}`, action: planInfo.subscribePlanAction };
  }

  return null;
}

// ── Sub-components ───────────────────────────────────────────────────

function PlanHeader({
  planInfo,
  isLocked,
}: {
  planInfo: ReturnType<typeof usePlan>['planInfo'];
  isLocked: boolean;
}) {
  const isPro = planInfo.plan === 'pro';
  const isPlus = planInfo.plan === 'plus';
  const isTrialing = planInfo.status === 'trial';
  const isActive = planInfo.status === 'active';

  const daysRemaining = planInfo.activeUntil
    ? Math.max(0, Math.ceil((new Date(planInfo.activeUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const cta = getPrimaryCta(planInfo, isLocked);
  const planLabel = isPro ? 'Pro' : isPlus ? 'Plus' : 'Free';

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] px-4 py-4 mb-7">
      <div className="flex items-center gap-2">
        <h3 className="text-[18px] font-bold text-[var(--text-primary)]">
          {planLabel} Plan
        </h3>
        {isTrialing && (
          <span className="rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-warning)]">
            Trial
          </span>
        )}
        {isActive && (
          <span className="rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-success)]">
            Active
          </span>
        )}
        {isLocked && (
          <span className="rounded-[var(--radius-sm)] bg-[var(--destructive-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--destructive)]">
            Expired
          </span>
        )}
      </div>

      <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
        {getPlanSubtitle(planInfo.plan, planInfo.features)}
      </p>

      {isTrialing && daysRemaining !== null && (
        <p className="text-[12px] text-[var(--color-warning)] mt-2">
          {daysRemaining === 0 ? 'Expires today' : `${daysRemaining} ${plural(daysRemaining, 'day')} remaining`}
        </p>
      )}

      {cta && (
        <CheckoutLink
          action={cta.action}
          target="_blank"
          className={cn(actionPrimary, 'mt-3 w-full sm:w-auto')}
        >
          {cta.label}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </CheckoutLink>
      )}
    </div>
  );
}

function UsageWarnings({ tiles }: { tiles: UsageTile[] }) {
  const warningTiles = tiles.filter(isNearLimit);
  if (warningTiles.length === 0) return null;

  return (
    <SettingsSection label="Usage">
      {warningTiles.map((tile) => (
        <div
          key={tile.label}
          className={cn(
            'flex items-center gap-2 py-2.5 text-[13px]',
            tile.isOver ? 'text-[var(--destructive)]' : 'text-[var(--color-warning)]',
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {tile.label}: {tile.used} / {tile.limit}
            {tile.isOver && <span className="font-medium"> — Over limit</span>}
          </span>
        </div>
      ))}
    </SettingsSection>
  );
}

function UnlockSection({
  planInfo,
}: {
  planInfo: ReturnType<typeof usePlan>['planInfo'];
}) {
  const { plan, features } = planInfo;
  const isTrialing = planInfo.status === 'trial';

  if (plan === 'pro') return null;
  if (planInfo.locked) return null;

  if (plan === 'plus' && isTrialing) {
    if (!isSafeCheckoutAction(planInfo.upgradeProAction)) return null;
    return (
      <SettingsSection label="Want more?">
        <CheckoutLink
          action={planInfo.upgradeProAction}
          target="_blank"
          className={cn('inline-flex items-center gap-1 rounded-[var(--radius-xs)] text-[13px] font-medium text-[var(--accent)] hover:underline', focusRing)}
        >
          Upgrade to Pro
          <ArrowUpRight className="h-3 w-3" />
        </CheckoutLink>
      </SettingsSection>
    );
  }

  const nextTierFeatures = getNextTierFeatures(plan, features);
  if (nextTierFeatures.length === 0) return null;

  const isFreePlan = plan === 'free';
  const label = isFreePlan ? 'Unlock with Plus' : 'Unlock with Pro';
  // Free users get their upgrade CTA from the PlanHeader above; the
  // UnlockSection is just a feature list. Plus users get an inline
  // "Upgrade to Pro" button using the POST-shaped upgradeProAction.
  const upgradeAction = isFreePlan ? null : planInfo.upgradeProAction;

  return (
    <SettingsSection label={label}>
      <ul className="flex flex-col gap-1.5 mb-3">
        {nextTierFeatures.map((feat) => (
          <li key={feat} className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-success)]" />
            {feat}
          </li>
        ))}
      </ul>
      {isSafeCheckoutAction(upgradeAction) && (
        <CheckoutLink
          action={upgradeAction}
          target="_blank"
          className={actionSecondary}
        >
          Upgrade to Pro
          <ArrowUpRight className="h-3 w-3" />
        </CheckoutLink>
      )}
    </SettingsSection>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function SubscriptionSection() {
  const { planInfo, isSelfHosted, isLocked, isLoading, refresh, refreshUsage, usage } = usePlan();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (handledRef.current) return;
    const status = searchParams.get('subscription');
    if (!status) return;
    handledRef.current = true;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('subscription');
      return next;
    }, { replace: true });

    if (status === 'success') {
      const previousStatus = planInfo.status;
      let attempt = 0;
      const poll = () => {
        if (attempt >= 15) return;
        attempt++;
        pollRef.current = setTimeout(async () => {
          const updated = await refresh();
          if (updated && updated.status !== previousStatus) {
            showToast({ message: 'Subscription updated successfully', variant: 'success' });
          } else {
            poll();
          }
        }, 3000);
      };
      poll();
    } else if (status === 'cancelled') {
      showToast({ message: 'Subscription update was cancelled', variant: 'default' });
    }

    return () => clearTimeout(pollRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- planInfo.status is captured once as previousStatus; re-running would cancel the poll
  }, [searchParams, setSearchParams, showToast, refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        refreshUsage();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh, refreshUsage]);

  const [downgrading, setDowngrading] = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);
  const handleDowngradeToFree = useCallback(async () => {
    setDowngrading(true);
    try {
      await apiFetch('/api/plan/downgrade-to-free', { method: 'POST' });
      await refresh();
      refreshUsage();
      setShowDowngradeConfirm(false);
      showToast({ message: 'Switched to the Free plan', variant: 'success' });
    } catch {
      showToast({ message: 'Failed to switch to Free plan', variant: 'error' });
    } finally {
      setDowngrading(false);
    }
  }, [refresh, refreshUsage, showToast]);

  if (isSelfHosted || isLoading) return null;

  const isFree = planInfo.plan === 'free';
  const isTrialing = planInfo.status === 'trial';
  const tiles = buildUsageTiles(planInfo, usage);
  const portalAvailable = isSafeCheckoutAction(planInfo.portalAction);
  const hasBillingContent = portalAvailable || planInfo.canDowngradeToFree;
  const showBilling = (!isFree || isTrialing) && hasBillingContent;

  return (
    <>
      <SettingsPageHeader title="Subscription" description="Manage your plan and billing." />

      {isLocked && (
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3.5 py-3 mb-5 bg-[var(--destructive-soft)] text-[var(--destructive)]">
          <Clock className="h-4 w-4 shrink-0" />
          <p className="text-[13px] font-medium">{getLockedMessage(planInfo.previousSubStatus)}</p>
        </div>
      )}

      <PlanHeader planInfo={planInfo} isLocked={isLocked} />

      <UsageWarnings tiles={tiles} />

      <UnlockSection planInfo={planInfo} />

      {showBilling && (
        <SettingsSection label="Billing">
          {portalAvailable && planInfo.portalAction && (
            <SettingsRow
              label="Manage Subscription"
              description="Update payment method, view invoices, or cancel"
              // submitCheckoutAction performs a transient form-POST in a
              // new tab so the JWT lands in the request body, not the URL.
              // Replaces the old window.open(portalUrl) which leaked the
              // token via location.href to Umami / browser history.
              onClick={() => submitCheckoutAction(planInfo.portalAction!, { target: '_blank' })}
            />
          )}
          {planInfo.canDowngradeToFree && (
            <>
              <button
                type="button"
                onClick={() => setShowDowngradeConfirm(true)}
                className={cn('mt-2 rounded-[var(--radius-xs)] text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors', focusRing)}
              >
                {isLocked ? 'Continue with Free Plan' : 'Switch to Free Plan'}
              </button>
              <Dialog open={showDowngradeConfirm} onOpenChange={setShowDowngradeConfirm}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Switch to Free Plan?</DialogTitle>
                    <DialogDescription>
                      {isTrialing
                        ? "Your trial will end immediately and you'll lose access to paid features. This cannot be undone."
                        : "You'll lose access to paid features right away. You can upgrade again later."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className={cn('flex items-start gap-2.5 rounded-[var(--radius-sm)] bg-[var(--destructive-soft)] px-3.5 py-3 text-[13px] text-[var(--destructive)]')}>
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Features like AI, custom fields, and expanded limits will be removed.</span>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDowngradeConfirm(false)}>
                      Keep Current Plan
                    </Button>
                    <Button variant="destructive" disabled={downgrading} onClick={handleDowngradeToFree}>
                      {downgrading ? 'Switching…' : 'Switch to Free'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </SettingsSection>
      )}
    </>
  );
}
