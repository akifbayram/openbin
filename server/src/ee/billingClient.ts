import * as jose from 'jose';
import { generateUuid } from '../db.js';
import { config } from '../lib/config.js';
import type { CancellationResult, DeletionContext } from '../lib/eeHooks.js';
import { createLogger } from '../lib/logger.js';
import { getSubscriptionSecretKey } from '../lib/planGate.js';

const log = createLogger('billingClient');

const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_BACKOFF_MS = 1_000;

async function signRequest(): Promise<string> {
  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('openbin-backend')
    .setAudience('openbin-manager')
    .setJti(generateUuid())
    .setExpirationTime('5m')
    .sign(getSubscriptionSecretKey());
}

/**
 * Issue a request to the billing service. Retries ONCE on 5xx or network
 * error; 4xx is final (the server understood and refused — re-trying won't
 * help). Returns the Response on the final attempt regardless of status so
 * callers can branch on the body.
 *
 * NOTE: the JWT is RE-SIGNED for the retry. JWTs are single-use (the billing
 * side uses jti replay protection); reusing the same token on retry would
 * be rejected.
 */
async function callBilling(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  if (!config.managerUrl) {
    throw new Error('MANAGER_URL not configured');
  }

  const url = `${config.managerUrl}${path}`;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await signRequest();
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.status < 500) return res;
      lastError = new Error(`billing returned ${res.status}`);
      log.warn(`Billing ${method} ${path} returned ${res.status} on attempt ${attempt + 1}`);
    } catch (err) {
      lastError = err;
      log.warn(`Billing ${method} ${path} threw on attempt ${attempt + 1}: ${err instanceof Error ? err.message : err}`);
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Billing service unreachable');
}

/**
 * Cancel any active Stripe subscription for the user. Per the contract:
 *   - { cancelled: true,  hadActiveSubscription: false } → safe to delete user
 *   - { cancelled: true,  hadActiveSubscription: true,  refundAmountCents? } → success
 *   - { cancelled: false, hadActiveSubscription: true,  reason } → orchestrator MUST abort
 *
 * Throws on transport-level failure (timeout, network, 5xx after retry); the
 * orchestrator treats a thrown error as a cancellation failure and aborts.
 */
export async function cancelSubscription(
  ctx: DeletionContext,
): Promise<CancellationResult> {
  const res = await callBilling(
    'POST',
    `/api/v1/customers/${encodeURIComponent(ctx.userId)}/cancel-subscription`,
    { refundPolicy: ctx.refundPolicy },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return {
      cancelled: false,
      hadActiveSubscription: true,
      reason: `billing ${res.status}: ${text || 'no body'}`,
    };
  }

  return (await res.json()) as CancellationResult;
}

/**
 * Delete the billing customer record. Idempotent: 404 is treated as success
 * (the record was already gone). 409 (active subs present) is propagated as
 * a thrown error so the cleanup job can log + retry next sweep — but in
 * practice this never happens because requestDeletion already cancelled.
 */
export async function deleteBillingCustomer(userId: string): Promise<void> {
  const res = await callBilling(
    'DELETE',
    `/api/v1/customers/${encodeURIComponent(userId)}`,
  );
  if (res.ok || res.status === 404) return;
  const text = await res.text().catch(() => '');
  throw new Error(`Billing customer delete failed: ${res.status} ${text}`);
}
