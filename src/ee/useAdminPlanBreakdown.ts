import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface PlanBreakdownTier {
  userCount: number;
  avgBins: number;
  avgItems: number;
  avgPhotos: number;
  avgStorageMb: number;
  avgLocations: number;
  avgMembersPerLocation: number;
  avgAiCreditsUsed: number;
  aiCreditsLimit: number | null;
  avgApiKeys: number;
  avgApiRequests7d: number;
  avgScans30d: number;
  atBinLimitPct: number;
  atStorageLimitPct: number;
}

export interface PlanBreakdownResponse {
  free: PlanBreakdownTier;
  plus: PlanBreakdownTier;
  pro: PlanBreakdownTier;
}

export function useAdminPlanBreakdown() {
  const [breakdown, setBreakdown] = useState<PlanBreakdownResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PlanBreakdownResponse>('/api/admin/metrics/plan-breakdown')
      .then(setBreakdown)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, []);

  return { breakdown, isLoading, error };
}
