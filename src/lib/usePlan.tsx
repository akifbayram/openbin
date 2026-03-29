import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, useRefreshOn } from '@/lib/eventBus';
import type { OverLimits, PlanFeatures, PlanInfo, PlanUsage } from '@/types';

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
    webhooks: true,
    maxLocations: null,
    maxPhotoStorageMb: null,
    maxMembersPerLocation: null,
    activityRetentionDays: null,
  },
  upgradeUrl: null,
  upgradeLiteUrl: null,
  upgradeProUrl: null,
  portalUrl: null,
};

interface PlanContextValue {
  planInfo: PlanInfo;
  isLoading: boolean;
  isPro: boolean;
  isLite: boolean;
  isSelfHosted: boolean;
  isLocked: boolean;
  isGated: (feature: keyof PlanFeatures) => boolean;
  refresh: () => Promise<PlanInfo | null>;
  overLimits: OverLimits | null;
  isOverAnyLimit: boolean;
  isLocationOverLimit: (locationId: string) => boolean;
  refreshUsage: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [overLimits, setOverLimits] = useState<OverLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const usageRefresh = useRefreshOn(Events.LOCATIONS, Events.PHOTOS);

  const fetchPlan = useCallback(async (): Promise<PlanInfo | null> => {
    if (!token) return null;
    try {
      const data = await apiFetch<PlanInfo>('/api/plan');
      const info = data.selfHosted ? SELF_HOSTED_PLAN : data;
      setPlanInfo(info);
      return info;
    } catch {
      setPlanInfo(SELF_HOSTED_PLAN);
      return SELF_HOSTED_PLAN;
    }
  }, [token]);

  const fetchUsage = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      const data = await apiFetch<PlanUsage>('/api/plan/usage');
      setOverLimits(data.overLimits);
    } catch {
      setOverLimits(null);
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
  }, [fetchPlan, fetchUsage]);

  useEffect(() => {
    if (usageRefresh > 0) fetchUsage();
  }, [usageRefresh, fetchUsage]);

  const value = useMemo<PlanContextValue>(() => {
    const info = planInfo ?? SELF_HOSTED_PLAN;
    const isPro = info.plan === 'pro';
    const isLite = info.plan === 'lite';
    const isSelfHosted = info.selfHosted;
    const isLocked = !!info.locked;
    const isGated = (feature: keyof PlanFeatures): boolean => {
      const val = info.features[feature];
      if (typeof val === 'boolean') return !val;
      if (val === null) return false;
      return false;
    };
    const isOverAnyLimit = overLimits !== null && (overLimits.locations || overLimits.photos || overLimits.members.length > 0);
    const isLocationOverLimit = (locationId: string) => overLimits?.members.includes(locationId) ?? false;

    return {
      planInfo: info,
      isLoading,
      isPro,
      isLite,
      isSelfHosted,
      isLocked,
      isGated,
      refresh: fetchPlan,
      overLimits,
      isOverAnyLimit,
      isLocationOverLimit,
      refreshUsage: fetchUsage,
    };
  }, [planInfo, isLoading, fetchPlan, overLimits, fetchUsage]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
