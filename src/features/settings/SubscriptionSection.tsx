import { ArrowUpRight, Clock, CreditCard } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api';
import { usePlan } from '@/lib/usePlan';
import { cn } from '@/lib/utils';

interface PlanUsage {
  locationCount: number;
  photoStorageMb: number;
  memberCounts: Record<string, number>;
}

function UsageBar({ label, current, max }: { label: string; current: number; max: number }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="text-[var(--text-tertiary)]">{current} / {max}</span>
      </div>
      <div className="h-2 rounded-[var(--radius-xs)] bg-[var(--bg-input)] overflow-hidden">
        <div className={cn('h-full rounded-[var(--radius-xs)] transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function SubscriptionSection() {
  const { planInfo, isPro, isSelfHosted, isLocked, refresh } = usePlan();
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
          label={<span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><CreditCard className="h-3.5 w-3.5" />Subscription</span>}
          labelClassName="text-[15px] font-semibold"
          defaultOpen={isTrialing || isLocked}
        >
        <div className="mt-1 space-y-3">
          {/* Plan status */}
          <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--bg-input)] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-medium text-[var(--text-primary)]">
                {isPro ? 'Pro' : 'Lite'} Plan
              </span>
              {isTrialing && (
                <span className="rounded-[var(--radius-sm)] bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  Trial
                </span>
              )}
            </div>
            {planInfo.portalUrl && (
              <a
                href={planInfo.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
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
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border-flat)] px-3 py-2 text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
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
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
                >
                  Upgrade to Pro
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* Trial/expiry info */}
          {isLocked && (
            <div className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] bg-red-500/10 text-red-600 dark:text-red-400">
              <Clock className="h-3.5 w-3.5" />
              Your trial has ended. Subscribe to continue using OpenBin.
            </div>
          )}
          {!isLocked && isTrialing && daysRemaining !== null && (
            <div className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              {`${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining in your trial`}
            </div>
          )}

          {/* Usage */}
          {usage && (planInfo.features.maxLocations !== null || planInfo.features.maxPhotoStorageMb !== null || planInfo.features.maxMembersPerLocation !== null) && (
            <div className="space-y-2 pt-1">
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Usage</p>
              {planInfo.features.maxLocations !== null && (
                <UsageBar label="Locations" current={usage.locationCount} max={planInfo.features.maxLocations} />
              )}
              {planInfo.features.maxPhotoStorageMb !== null && (
                <UsageBar
                  label={`Photo Storage (${usage.photoStorageMb.toFixed(1)} MB / ${planInfo.features.maxPhotoStorageMb} MB)`}
                  current={usage.photoStorageMb}
                  max={planInfo.features.maxPhotoStorageMb}
                />
              )}
              {planInfo.features.maxMembersPerLocation !== null && (() => {
                const maxMembers = Math.max(0, ...Object.values(usage.memberCounts));
                const limit = planInfo.features.maxMembersPerLocation ?? 0;
                return (
                  <UsageBar label="Members per location" current={maxMembers} max={limit} />
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
