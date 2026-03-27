import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PlanFeatures, PlanInfo } from '@/types';

// Self-hosted mode: full pro features, no API call needed
const SELF_HOSTED_PLAN: PlanInfo = {
  plan: 'pro',
  status: 'active',
  activeUntil: null,
  selfHosted: true,
  features: {
    ai: true,
    apiKeys: true,
    customFields: true,
    fullExport: true,
    maxLocations: null,
    maxBinsPerLocation: null,
    maxPhotoStorageMb: null,
    maxMembersPerLocation: null,
    activityRetentionDays: null,
  },
  upgradeUrl: null,
};

interface PlanContextValue {
  planInfo: PlanInfo;
  isLoading: boolean;
  isPro: boolean;
  isLite: boolean;
  isSelfHosted: boolean;
  isGated: (feature: keyof PlanFeatures) => boolean;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<PlanInfo>('/api/plan')
      .then((data) => {
        if (!cancelled) {
          if (data.selfHosted) {
            setPlanInfo(SELF_HOSTED_PLAN);
          } else {
            setPlanInfo(data);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          // On error (e.g. self-hosted without plan endpoint), fall back to self-hosted plan
          setPlanInfo(SELF_HOSTED_PLAN);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [token]);

  const value = useMemo<PlanContextValue>(() => {
    const info = planInfo ?? SELF_HOSTED_PLAN;
    const isPro = info.plan === 'pro';
    const isLite = info.plan === 'lite';
    const isSelfHosted = info.selfHosted;
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
      isGated,
    };
  }, [planInfo, isLoading]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
