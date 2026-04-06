import { ArrowUpRight, Clock, CreditCard } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api';
import { getLockedCta, getLockedMessage, usePlan } from '@/lib/usePlan';
import { cn, focusRing } from '@/lib/utils';

const actionBase = cn(
  'inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-md)] h-9 px-3.5 text-[13px] font-semibold transition-colors',
  focusRing,
);
const actionSecondary = cn(actionBase, 'border border-[var(--border-flat)] bg-[var(--bg-input)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]');
const actionPrimary = cn(actionBase, 'bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)]');

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
      label: 'Members per Location',
      used: maxMembers,
      limit: features.maxMembersPerLocation,
      isOver: maxMembers > features.maxMembersPerLocation,
    });
  }

  return tiles;
}

/** Hide tiles that convey no useful info (e.g. 0/0 photos, 1/1 locations on free/plus). */
function isRedundantTile(tile: UsageTile): boolean {
  if (tile.isOver) return false;
  const limit = typeof tile.limit === 'number' ? tile.limit : null;
  return limit !== null && limit <= 1;
}

interface ActionButton {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

function buildActions(planInfo: ReturnType<typeof usePlan>['planInfo'], isLocked: boolean): ActionButton[] {
  const actions: ActionButton[] = [];

  if (isLocked) {
    const label = getLockedCta(planInfo.previousSubStatus);
    const href = planInfo.subscribePlanUrl ?? planInfo.upgradeUrl;
    if (href) actions.push({ label, href, variant: 'primary' });
    return actions;
  }

  if (planInfo.plan === 'free' && planInfo.upgradeUrl) {
    actions.push({ label: 'Upgrade', href: planInfo.upgradeUrl, variant: 'primary' });
    return actions;
  }

  const isTrialing = planInfo.status === 'trial';

  // Secondary (left) button
  if (isTrialing && planInfo.subscribePlanUrl) {
    const planName = planInfo.plan === 'plus' ? 'Plus' : 'Pro';
    actions.push({ label: `Subscribe to ${planName}`, href: planInfo.subscribePlanUrl, variant: 'secondary' });
  } else if (planInfo.portalUrl) {
    actions.push({ label: 'Manage Subscription', href: planInfo.portalUrl, variant: 'secondary' });
  } else if (planInfo.upgradePlusUrl) {
    actions.push({ label: 'Upgrade to Plus', href: planInfo.upgradePlusUrl, variant: 'secondary' });
  }

  // Primary (right) button
  if (planInfo.upgradeProUrl) {
    actions.push({ label: 'Upgrade to Pro', href: planInfo.upgradeProUrl, variant: 'primary' });
  } else if (isTrialing && planInfo.subscribePlanUrl && actions.length === 0) {
    // Pro trial: subscribePlanUrl is the only action, show as primary
    const planName = planInfo.plan === 'plus' ? 'Plus' : 'Pro';
    actions.push({ label: `Subscribe to ${planName}`, href: planInfo.subscribePlanUrl, variant: 'primary' });
  }

  return actions;
}

export function SubscriptionSection() {
  const { planInfo, isPro, isPlus, isSelfHosted, isLocked, isLoading, refresh, refreshUsage, usage } = usePlan();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRef = useRef(false);

  // Handle return from external payment page via URL params
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

  // Refetch plan + usage when page regains visibility (user returning from payment tab)
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

  const isTrialing = planInfo.status === 'trial';
  const daysRemaining = planInfo.activeUntil
    ? Math.max(0, Math.ceil((new Date(planInfo.activeUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const tiles = buildUsageTiles(planInfo, usage).filter(t => isPro || !isRedundantTile(t));
  const actions = buildActions(planInfo, isLocked);

  return (
    <Card>
      <CardContent>
        <Disclosure
          label={<span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><CreditCard className="h-4 w-4" />Subscription</span>}
          labelClassName="text-[15px] font-semibold"
          defaultOpen={isTrialing || isLocked}
        >
        <div className="flex flex-col gap-2.5 mt-1">
          {/* Plan status */}
          <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--bg-input)] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-medium text-[var(--text-primary)]">
                {isPro ? 'Pro' : isPlus ? 'Plus' : 'Free'} Plan
              </span>
              {isTrialing && (
                <span className="rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
                  Trial
                </span>
              )}
            </div>
            {isTrialing && daysRemaining !== null && (
              <span className="text-[12px] text-[var(--color-warning)]">
                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
              </span>
            )}
          </div>

          {/* Warning banner (locked/expired) */}
          {isLocked && (
            <div className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] bg-[var(--destructive-soft)] text-[var(--destructive)]">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {getLockedMessage(planInfo.previousSubStatus)}
            </div>
          )}

          {/* Usage grid */}
          {tiles.length > 0 && (
            <div className="grid grid-cols-6 gap-2">
              {tiles.map((tile, i) => {
                const total = tiles.length;
                let spanClass: string;
                if (total <= 2) {
                  spanClass = total === 1 ? 'col-span-6' : 'col-span-3';
                } else if (i < 3) {
                  spanClass = 'col-span-2';
                } else {
                  spanClass = total - 3 === 1 ? 'col-span-6' : 'col-span-3';
                }
                return (
                  <div
                    key={tile.label}
                    className={cn(
                      'rounded-[var(--radius-sm)] px-3 py-2.5',
                      tile.isOver ? 'bg-[var(--destructive-soft)]'
                        : tile.isExhausted ? 'bg-[var(--color-warning-soft)]'
                        : 'bg-[var(--bg-input)]',
                      spanClass,
                    )}
                  >
                    <div className="text-[11px] text-[var(--text-tertiary)]">
                      {tile.label}
                      {tile.sublabel && (
                        <span className="ml-1 text-[10px]">&middot; {tile.sublabel}</span>
                      )}
                    </div>
                    <div className={cn(
                      'text-[15px] font-semibold tabular-nums text-[var(--text-primary)]',
                      tile.isOver && 'text-[var(--destructive)]',
                      tile.isExhausted && 'text-[var(--color-warning)]',
                    )}>
                      {tile.used}{' '}
                      <span className={cn(
                        'text-[12px] font-normal text-[var(--text-tertiary)]',
                        tile.isOver && 'text-[var(--destructive)]',
                      )}>
                        / {tile.limit}
                      </span>
                      {tile.isOver && (
                        <span className="text-[11px] font-normal"> — Over limit</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div className="flex gap-2">
              {actions.map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={action.variant === 'primary' ? actionPrimary : actionSecondary}
                >
                  {action.label}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}

          {/* Downgrade to Free */}
          {planInfo.canDowngradeToFree && (
            <button
              type="button"
              disabled={downgrading}
              onClick={handleDowngradeToFree}
              className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors text-center"
            >
              {isLocked ? 'Continue with Free Plan' : 'Switch to Free Plan'}
            </button>
          )}
        </div>
        </Disclosure>
      </CardContent>
    </Card>
  );
}
