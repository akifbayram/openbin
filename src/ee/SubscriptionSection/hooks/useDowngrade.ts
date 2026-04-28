import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Events, notify } from '@/lib/eventBus';

interface UseDowngradeResult {
  downgrade: (targetPlan: 'free' | 'plus') => Promise<void>;
  isPending: boolean;
  error: Error | null;
}

export function useDowngrade(): UseDowngradeResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const downgrade = async (targetPlan: 'free' | 'plus') => {
    setIsPending(true);
    setError(null);
    try {
      await apiFetch('/api/plan/downgrade', {
        method: 'POST',
        body: { targetPlan },
      });
      notify(Events.PLAN);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return { downgrade, isPending, error };
}
