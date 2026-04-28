import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, useRefreshOn } from '@/lib/eventBus';
import { isSelfHostedInstance } from '@/lib/qrConfig';
import type { OverLimits, PlanFeatures, PlanInfo, PlanUsage } from '@/types';

export function getLockedMessage(previousSubStatus: 'trial' | 'active' | null): string {
  if (previousSubStatus === 'trial') return 'Your trial has ended. Subscribe to continue using OpenBin.';
  if (previousSubStatus === 'active') return 'Your subscription has expired. Resubscribe to continue using OpenBin.';
  return 'Your plan is inactive. Subscribe to continue using OpenBin.';
}

export function getLockedCta(previousSubStatus: 'trial' | 'active' | null): string {
  return previousSubStatus === 'trial' ? 'Subscribe' : 'Resubscribe';
}

const SELF_HOSTED_PLAN: PlanInfo = {
  plan: 'pro',
  status: 'active',
  activeUntil: null,
  previousSubStatus: null,
  selfHosted: true,
  locked: false,
  features: {
    ai: true,
    apiKeys: true,
    customFields: true,
    fullExport: true,
    reorganize: true,
    binSharing: true,
    attachments: true,
    maxBins: null,
    maxLocations: null,
    maxPhotoStorageMb: null,
    maxMembersPerLocation: null,
    activityRetentionDays: null,
    aiCreditsPerMonth: null,
    reorganizeMaxBins: null,
  },
  upgradeUrl: null,
  upgradePlusUrl: null,
  upgradeProUrl: null,
  portalUrl: null,
  subscribePlanUrl: null,
  upgradeAction: null,
  upgradePlusAction: null,
  upgradeProAction: null,
  subscribePlanAction: null,
  portalAction: null,
  canDowngradeToFree: false,
  aiCredits: null,
  cancelAtPeriodEnd: null,
  billingPeriod: null,
};

/** Restrictive fallback used when plan fetch fails and no prior data exists */
const LOCKED_FALLBACK: PlanInfo = {
  plan: 'free',
  status: 'inactive',
  activeUntil: null,
  previousSubStatus: null,
  selfHosted: false,
  locked: true,
  features: {
    ai: true,
    apiKeys: false,
    customFields: false,
    fullExport: false,
    reorganize: false,
    binSharing: false,
    attachments: false,
    maxBins: 10,
    maxLocations: 1,
    maxPhotoStorageMb: 0,
    maxMembersPerLocation: 1,
    activityRetentionDays: 7,
    aiCreditsPerMonth: 10,
    reorganizeMaxBins: 10,
  },
  upgradeUrl: null,
  upgradePlusUrl: null,
  upgradeProUrl: null,
  portalUrl: null,
  subscribePlanUrl: null,
  upgradeAction: null,
  upgradePlusAction: null,
  upgradeProAction: null,
  subscribePlanAction: null,
  portalAction: null,
  canDowngradeToFree: false,
  aiCredits: null,
  cancelAtPeriodEnd: null,
  billingPeriod: null,
};

interface PlanContextValue {
  planInfo: PlanInfo;
  isLoading: boolean;

  isPro: boolean;
  isPlus: boolean;
  isFree: boolean;
  isSelfHosted: boolean;
  isLocked: boolean;
  isGated: (feature: keyof PlanFeatures) => boolean;
  refresh: () => Promise<PlanInfo | null>;
  usage: PlanUsage | null;
  overLimits: OverLimits | null;
  isOverAnyLimit: boolean;
  isLocationOverLimit: (locationId: string) => boolean;
  refreshUsage: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  // Self-hosted detection is synchronous. `initQrConfig` fires at module load in
  // App.tsx, so `isSelfHostedInstance()` has flipped to the server-reported value
  // before this provider mounts. Self-hosted instances skip every /api/plan and
  // /api/plan/usage request and use the static SELF_HOSTED_PLAN constant.
  const [selfHosted] = useState(() => isSelfHostedInstance());
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(selfHosted ? SELF_HOSTED_PLAN : null);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [isLoading, setIsLoading] = useState(!selfHosted);

  const usageRefresh = useRefreshOn(Events.LOCATIONS, Events.PHOTOS);
  const planRefresh = useRefreshOn(Events.PLAN);

  const fetchPlan = useCallback(async (): Promise<PlanInfo | null> => {
    if (!token) return null;
    if (selfHosted) {
      setPlanInfo(SELF_HOSTED_PLAN);
      return SELF_HOSTED_PLAN;
    }
    try {
      const data = await apiFetch<PlanInfo>('/api/plan');
      const info = data.selfHosted ? SELF_HOSTED_PLAN : data;
      setPlanInfo(info);

      return info;
    } catch {
      setPlanInfo((prev) => prev ?? LOCKED_FALLBACK);

      return null;
    }
  }, [token, selfHosted]);

  const fetchUsage = useCallback(async (): Promise<void> => {
    if (!token) return;
    // Self-hosted has no plan limits — skip the request entirely.
    if (selfHosted) return;
    try {
      const data = await apiFetch<PlanUsage>('/api/plan/usage');
      setUsage(data);
    } catch {
      // Retain last known usage on failure
    }
  }, [token, selfHosted]);

  useEffect(() => {
    if (selfHosted) return;
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.all([fetchPlan(), fetchUsage()]).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [fetchPlan, fetchUsage, token, selfHosted]);

  useEffect(() => {
    if (selfHosted) return;
    if (usageRefresh > 0) fetchUsage();
  }, [usageRefresh, fetchUsage, selfHosted]);

  useEffect(() => {
    if (selfHosted) return;
    if (planRefresh > 0) fetchPlan();
  }, [planRefresh, fetchPlan, selfHosted]);

  const value = useMemo<PlanContextValue>(() => {
    const info = planInfo ?? LOCKED_FALLBACK;
    const isPro = info.plan === 'pro';
    const isPlus = info.plan === 'plus';
    const isFree = info.plan === 'free';
    const isSelfHosted = info.selfHosted;
    const isLocked = !!info.locked;
    const isGated = (feature: keyof PlanFeatures): boolean => {
      const val = info.features[feature];
      return typeof val === 'boolean' ? !val : false;
    };
    const overLimits = usage?.overLimits ?? null;
    const isOverAnyLimit = overLimits !== null && (overLimits.locations || overLimits.photos || overLimits.members.length > 0);
    const isLocationOverLimit = (locationId: string) => overLimits?.members.includes(locationId) ?? false;

    return {
      planInfo: info,
      isLoading,

      isPro,
      isPlus,
      isFree,
      isSelfHosted,
      isLocked,
      isGated,
      refresh: fetchPlan,
      usage,
      overLimits,
      isOverAnyLimit,
      isLocationOverLimit,
      refreshUsage: fetchUsage,
    };
  }, [planInfo, isLoading, fetchPlan, usage, fetchUsage]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
