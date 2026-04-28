import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { DowngradeImpact } from '@/types';

interface UseDowngradeImpactResult {
  impact: DowngradeImpact | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useDowngradeImpact(targetPlan: 'free' | 'plus' | null): UseDowngradeImpactResult {
  const [impact, setImpact] = useState<DowngradeImpact | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is a refetch trigger
  useEffect(() => {
    if (!targetPlan) {
      setImpact(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiFetch<DowngradeImpact>('/api/plan/downgrade-impact', {
      method: 'POST',
      body: { targetPlan },
    })
      .then(data => { if (!cancelled) setImpact(data); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err : new Error(String(err))); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [targetPlan, tick]);

  return { impact, isLoading, error, refetch: () => setTick(t => t + 1) };
}
