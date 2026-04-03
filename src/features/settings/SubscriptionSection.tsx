import { ArrowUpRight, Clock, CreditCard } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api';
import { getLockedMessage, usePlan } from '@/lib/usePlan';
import { cn, focusRing } from '@/lib/utils';
import type { PlanUsage } from '@/types';

export function SubscriptionSection() {
  const { planInfo, isPro, isLite, isSelfHosted, isLocked, refresh } = usePlan();
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

    // Clean the URL param
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('subscription');
      return next;
    }, { replace: true });

    if (status === 'success') {
      // Webhook may not have arrived yet — poll until plan updates
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

  // Refetch plan when page regains visibility (user returning from payment tab)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const [usage, setUsage] = useState<PlanUsage | null>(null);

  useEffect(() => {
    if (isSelfHosted) return;
    apiFetch<PlanUsage>('/api/plan/usage').then(setUsage).catch(() => {});
  }, [isSelfHosted]);

  // Don't render in self-hosted mode
  if (isSelfHosted) return null;

  const isTrialing = planInfo.status === 'trial';
  const daysRemaining = planInfo.activeUntil
    ? Math.max(0, Math.ceil((new Date(planInfo.activeUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <Card>
      <CardContent>
        <Disclosure
          label={<span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><CreditCard className="h-4 w-4" />Subscription</span>}
          labelClassName="text-[15px] font-semibold"
          defaultOpen={isTrialing || isLocked}
        >
        <div className="flex flex-col gap-3 mt-1">
          {/* Plan status */}
          <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--bg-input)] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-medium text-[var(--text-primary)]">
                {isPro ? 'Pro' : 'Lite'} Plan
              </span>
              {isTrialing && (
                <span className="rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
                  Trial
                </span>
              )}
            </div>
            {planInfo.portalUrl && (
              <a
                href={planInfo.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--accent)] h-9 px-3.5 text-[13px] font-semibold text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] transition-colors', focusRing)}
              >
                Manage Subscription
                <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Upgrade buttons (no active paid subscription) */}
          {(planInfo.upgradeLiteUrl || planInfo.upgradeProUrl) && (
            <div className="flex items-center gap-2">
              {planInfo.upgradeLiteUrl && (
                <a
                  href={planInfo.upgradeLiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-flat)] bg-[var(--bg-input)] h-9 px-3.5 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors', focusRing)}
                >
                  Upgrade to Lite
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
              {planInfo.upgradeProUrl && (
                <a
                  href={planInfo.upgradeProUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-md)] bg-[var(--accent)] h-9 px-3.5 text-[13px] font-semibold text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] transition-colors', focusRing)}
                >
                  Upgrade to Pro
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* Lite entitlements */}
          {isLite && !isLocked && planInfo.status === 'active' && (
            <ul className="flex flex-col gap-0.5 text-[13px] text-[var(--text-secondary)] px-1">
              {planInfo.features.maxLocations !== null && (
                <li>{planInfo.features.maxLocations} {planInfo.features.maxLocations === 1 ? 'location' : 'locations'}</li>
              )}
              {planInfo.features.maxPhotoStorageMb !== null && (
                <li>{planInfo.features.maxPhotoStorageMb} MB photo storage</li>
              )}
              <li>Unlimited bins</li>
              {planInfo.features.maxMembersPerLocation !== null && (
                <li>{planInfo.features.maxMembersPerLocation} {planInfo.features.maxMembersPerLocation === 1 ? 'member' : 'members'} per location</li>
              )}
            </ul>
          )}

          {/* Trial/expiry info */}
          {isLocked && (
            <div className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] bg-[var(--destructive-soft)] text-[var(--destructive)]">
              <Clock className="h-3.5 w-3.5" />
              {getLockedMessage(planInfo.previousSubStatus)}
            </div>
          )}
          {!isLocked && isTrialing && daysRemaining !== null && (
            <div className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
              <Clock className="h-3.5 w-3.5" />
              {`${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining in your trial`}
            </div>
          )}

          {/* Usage */}
          {usage && (planInfo.features.maxLocations !== null || planInfo.features.maxPhotoStorageMb !== null || planInfo.features.maxMembersPerLocation !== null) && (
            <div className="space-y-2 pt-1">
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Usage</p>
              {planInfo.features.maxLocations !== null && (
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--text-secondary)]">Locations</span>
                  <span className={cn('tabular-nums text-[var(--text-tertiary)]', usage.locationCount > planInfo.features.maxLocations && 'text-[var(--destructive)] font-semibold')}>
                    {usage.locationCount} / {planInfo.features.maxLocations}{usage.locationCount > planInfo.features.maxLocations && ' — Over limit'}
                  </span>
                </div>
              )}
              {planInfo.features.maxPhotoStorageMb !== null && (
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--text-secondary)]">Photo Storage</span>
                  <span className={cn('tabular-nums text-[var(--text-tertiary)]', usage.photoStorageMb > planInfo.features.maxPhotoStorageMb && 'text-[var(--destructive)] font-semibold')}>
                    {usage.photoStorageMb.toFixed(1)} MB / {planInfo.features.maxPhotoStorageMb} MB{usage.photoStorageMb > planInfo.features.maxPhotoStorageMb && ' — Over limit'}
                  </span>
                </div>
              )}
              {planInfo.features.maxMembersPerLocation !== null && (() => {
                const maxMembers = Math.max(0, ...Object.values(usage.memberCounts));
                return (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--text-secondary)]">Members per Location</span>
                    <span className={cn('tabular-nums text-[var(--text-tertiary)]', maxMembers > planInfo.features.maxMembersPerLocation && 'text-[var(--destructive)] font-semibold')}>
                      {maxMembers} / {planInfo.features.maxMembersPerLocation}{maxMembers > planInfo.features.maxMembersPerLocation && ' — Over limit'}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
        </Disclosure>
      </CardContent>
    </Card>
  );
}
