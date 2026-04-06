import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface CloudMetrics {
  plans: { liteActive: number; liteInactive: number; plusTrial: number; proActive: number; proInactive: number; total: number };
  bins: { total: number; avgPerLocation: number; createdLast7d: number; createdLast30d: number };
  storage: { totalMb: number; avgPerLocationMb: number; nearingLimitCount: number };
  trialConversion: { started: number; converted: number; expired: number; active: number; rate: number };
  featureAdoption: Record<string, { usersOrLocations: number; percentage: number }>;
  warnings: string[];
}

export function useAdminMetrics() {
  const [metrics, setMetrics] = useState<CloudMetrics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch<CloudMetrics>('/api/admin/metrics')
      .then(setMetrics)
      .catch(() => setError(true));
  }, []);

  return { metrics, error };
}
