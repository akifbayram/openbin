import { AlertTriangle, ArrowUpRight, Clock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import { SettingsRow } from '@/features/settings/SettingsRow';
import { SettingsSection } from '@/features/settings/SettingsSection';
import { apiFetch } from '@/lib/api';
import { getLockedCta, getLockedMessage, usePlan } from '@/lib/usePlan';
import { cn, focusRing, isSafeExternalUrl } from '@/lib/utils';
import type { PlanFeatures, PlanTier } from '@/types';

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
      used: `${usage.photoStorageMb.toFixed(1)}`,
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
  const limit = typeof tile.limit === 'number' ? tile.limit : parseFloat(tile.limit);
  if (!Number.isNaN(limit) && limit <= 1) return false;
  const used = typeof tile.used === 'number' ? tile.used : parseFloat(tile.used);
  if (Number.isNaN(used) || Number.isNaN(limit) || limit <= 0) return false;
  return used / limit >= NEAR_LIMIT_THRESHOLD;
}

const PLUS_FEATURES: Array<{ key: keyof PlanFeatures; label: string }> = [
  { key: 'maxBins', label: 'Up to 500 bins' },
  { key: 'ai', label: 'AI-powered features' },
  { key: 'customFields', label: 'Custom fields' },
  { key: 'fullExport', label: 'Full data export' },
];

const PRO_FEATURES: Array<{ key: keyof PlanFeatures; label: string }> = [
  { key: 'maxBins', label: 'Unlimited bins' },
  { key: 'apiKeys', label: 'API keys' },
  { key: 'reorganize', label: 'AI reorganization' },
  { key: 'binSharing', label: 'Bin sharing links' },
  { key: 'maxLocations', label: 'Unlimited locations' },
  { key: 'maxPhotoStorageMb', label: 'Expanded photo storage' },
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
): { label: string; href: string } | null {
  if (isLocked) {
    const label = getLockedCta(planInfo.previousSubStatus);
    const href = planInfo.subscribePlanUrl ?? planInfo.upgradeUrl;
    if (href) return { label, href };
    return null;
  }

  const isTrialing = planInfo.status === 'trial';

  if (planInfo.plan === 'free' && planInfo.upgradeUrl) {
    return { label: 'Upgrade', href: planInfo.upgradeUrl };
  }

  if (isTrialing && planInfo.subscribePlanUrl) {
    const planName = planInfo.plan === 'plus' ? 'Plus' : 'Pro';
    return { label: `Subscribe to ${planName}`, href: planInfo.subscribePlanUrl };
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
        {isActive && !isTrialing && (
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
          {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
        </p>
      )}

      {cta && isSafeExternalUrl(cta.href) && (
        <a
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(actionPrimary, 'mt-3 w-full sm:w-auto')}
        >
          {cta.label}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
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
    if (!planInfo.upgradeProUrl) return null;
    return (
      <SettingsSection label="Want more?">
        <a
          href={planInfo.upgradeProUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          Upgrade to Pro
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </SettingsSection>
    );
  }

  const nextTierFeatures = getNextTierFeatures(plan, features);
  if (nextTierFeatures.length === 0) return null;

  const isFreePlan = plan === 'free';
  const label = isFreePlan ? 'Unlock with Plus' : 'Unlock with Pro';
  // For free plan, the PlanHeader already shows the primary upgrade CTA; skip the button here
  const upgradeHref = isFreePlan ? null : planInfo.upgradeProUrl;

  return (
    <SettingsSection label={label}>
      <ul className="flex flex-col gap-1.5 mb-3">
        {nextTierFeatures.map((feat) => (
          <li key={feat} className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <span className="text-[var(--color-success)]">&#10003;</span>
            {feat}
          </li>
        ))}
      </ul>
      {upgradeHref && isSafeExternalUrl(upgradeHref) && (
        <a
          href={upgradeHref}
          target="_blank"
          rel="noopener noreferrer"
          className={actionSecondary}
        >
          {isFreePlan ? 'Upgrade to Plus' : 'Upgrade to Pro'}
          <ArrowUpRight className="h-3 w-3" />
        </a>
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
  }, [searchParams, setSearchParams, showToast, refresh, planInfo.status]);

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
  const handleDowngradeToFree = useCallback(async () => {
    setDowngrading(true);
    try {
      await apiFetch('/api/plan/downgrade-to-free', { method: 'POST' });
      await refresh();
      refreshUsage();
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
  const showBilling = !isFree || isTrialing;

  return (
    <>
      <div className="mb-6">
        <h2 className="text-[20px] font-bold text-[var(--text-primary)]">Subscription</h2>
        <p className="text-[13px] text-[var(--text-tertiary)]">Manage your plan and billing.</p>
      </div>

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
          {planInfo.portalUrl && isSafeExternalUrl(planInfo.portalUrl) && (
            <SettingsRow
              label="Manage Subscription"
              description="Update payment method, view invoices, or cancel"
              onClick={() => window.open(planInfo.portalUrl ?? '', '_blank', 'noopener,noreferrer')}
            />
          )}
          {planInfo.canDowngradeToFree && (
            <button
              type="button"
              disabled={downgrading}
              onClick={handleDowngradeToFree}
              className="mt-2 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
            >
              {isLocked ? 'Continue with Free Plan' : 'Switch to Free Plan'}
            </button>
          )}
        </SettingsSection>
      )}
    </>
  );
}
