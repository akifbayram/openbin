import { generateUuid, query } from '../db.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('subscriptionOrphans');

/**
 * Append an audit row when a subscription callback arrives for a userId
 * that no longer exists. Stripe will retry on 5xx — returning 200 + logging
 * here prevents a retry storm while preserving the billing state for ops
 * to reconcile manually if needed.
 *
 * Reasons we currently emit:
 *   - 'user_not_found' — UPDATE users WHERE id=$1 returned 0 rows
 */
export async function logOrphan(
  userIdAttempted: string,
  payload: unknown,
  reason: string,
): Promise<void> {
  try {
    await query(
      'INSERT INTO subscription_orphans (id, user_id_attempted, payload_json, reason) VALUES ($1, $2, $3, $4)',
      [generateUuid(), userIdAttempted, JSON.stringify(payload), reason],
    );
    log.warn(`Subscription callback for unknown user ${userIdAttempted}: ${reason}`);
  } catch (err) {
    // Never throw out of an audit logger — the worst case is we silently lose
    // an audit row, but losing the response to Stripe (who would then retry)
    // is worse.
    log.error(`Failed to record subscription orphan: ${err instanceof Error ? err.message : err}`);
  }
}
