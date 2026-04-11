import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, useRefreshOn } from '@/lib/eventBus';
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
    maxBins: null,
    maxLocations: null,
    maxPhotoStorageMb: null,
    maxMembersPerLocation: null,
    activityRetentionDays: null,
    aiCreditsPerMonth: null,
  },
  upgradeUrl: null,
  upgradePlusUrl: null,
  upgradeProUrl: null,
  portalUrl: null,
  subscribePlanUrl: null,
  canDowngradeToFree: false,
  aiCredits: null,
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
    ai: false,
    apiKeys: false,
    customFields: false,
    fullExport: true,
    reorganize: false,
    binSharing: false,
    maxBins: 50,
    maxLocations: 1,
    maxPhotoStorageMb: 0,
    maxMembersPerLocation: 1,
    activityRetentionDays: 7,
    aiCreditsPerMonth: 0,
  },
  upgradeUrl: null,
  upgradePlusUrl: null,
  upgradeProUrl: null,
  portalUrl: null,
  subscribePlanUrl: null,
  canDowngradeToFree: false,
  aiCredits: null,
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
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const usageRefresh = useRefreshOn(Events.LOCATIONS, Events.PHOTOS);
  const planRefresh = useRefreshOn(Events.PLAN);

  const fetchPlan = useCallback(async (): Promise<PlanInfo | null> => {
    if (!token) return null;
    try {
      const data = await apiFetch<PlanInfo>('/api/plan');
      const info = data.selfHosted ? SELF_HOSTED_PLAN : data;
      setPlanInfo(info);

      return info;
    } catch {
      setPlanInfo((prev) => prev ?? LOCKED_FALLBACK);

      return null;
    }
  }, [token]);

  const fetchUsage = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      const data = await apiFetch<PlanUsage>('/api/plan/usage');
      setUsage(data);
    } catch {
      // Retain last known usage on failure
    }
  }, [token]);

  useEffect(() => {
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
  }, [fetchPlan, fetchUsage, token]);

  useEffect(() => {
    if (usageRefresh > 0) fetchUsage();
  }, [usageRefresh, fetchUsage]);

  useEffect(() => {
    if (planRefresh > 0) fetchPlan();
  }, [planRefresh, fetchPlan]);

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
