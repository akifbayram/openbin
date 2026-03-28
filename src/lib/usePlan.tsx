import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PlanFeatures, PlanInfo } from '@/types';

// Self-hosted mode: full pro features, no API call needed
const SELF_HOSTED_PLAN: PlanInfo = {
  plan: 'pro',
  status: 'active',
  activeUntil: null,
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
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchPlan().finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [fetchPlan]);

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

    return {
      planInfo: info,
      isLoading,
      isPro,
      isLite,
      isSelfHosted,
      isLocked,
      isGated,
      refresh: fetchPlan,
    };
  }, [planInfo, isLoading, fetchPlan]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
