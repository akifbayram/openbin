import { config } from './config.js';
import { BillingNotConfiguredError } from './httpErrors.js';

export interface BillingDowngradeRequest {
  userId: string;
  targetPlan: 'free' | 'plus';
}

export interface BillingDowngradeResult {
  ok: true;
  cancelAtPeriodEnd: string | null;
  effectiveAt: 'now' | 'period-end';
}

export async function postBillingDowngrade(req: BillingDowngradeRequest): Promise<BillingDowngradeResult> {
  if (!config.billingInternalUrl || !config.billingInternalKey) {
    throw new BillingNotConfiguredError(
      'BILLING_INTERNAL_URL or BILLING_INTERNAL_KEY not configured',
    );
  }

  const res = await fetch(`${config.billingInternalUrl}/internal/downgrade`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.billingInternalKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Billing downgrade failed: ${res.status} ${text}`);
  }

  return (await res.json()) as BillingDowngradeResult;
}
