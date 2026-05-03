import { useState } from 'react';
import { submitCheckoutAction } from '@/ee/checkoutAction';
import { apiFetch } from '@/lib/api';
import { Events, notify } from '@/lib/eventBus';
import type { CheckoutAction } from '@/types';

interface UseDowngradeResult {
  downgrade: (targetPlan: 'free' | 'plus') => Promise<DowngradeOutcome>;
  isPending: boolean;
  error: Error | null;
}

export type DowngradeOutcome = 'redirected' | 'completed';

interface DowngradeResponse {
  portalFlowAction?: CheckoutAction;
}

export function useDowngrade(): UseDowngradeResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const downgrade = async (targetPlan: 'free' | 'plus'): Promise<DowngradeOutcome> => {
    setIsPending(true);
    setError(null);
    try {
      const res = await apiFetch<DowngradeResponse>('/api/plan/downgrade', {
        method: 'POST',
        body: { targetPlan },
      });
      if (res.portalFlowAction) {
        submitCheckoutAction(res.portalFlowAction, { target: '_self' });
        return 'redirected';
      }
      notify(Events.PLAN);
      return 'completed';
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return { downgrade, isPending, error };
}
