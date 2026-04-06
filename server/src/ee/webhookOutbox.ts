import * as jose from 'jose';
import { d, generateUuid, query } from '../db.js';
import { config } from '../lib/config.js';
import { acquireJobLock, releaseJobLock } from '../lib/jobLock.js';
import { createLogger } from '../lib/logger.js';
import { getSubscriptionSecretKey } from '../lib/planGate.js';

const log = createLogger('webhookOutbox');

const PROCESS_INTERVAL_MS = 30_000;
const BATCH_SIZE = 10;
const MAX_AGE_SECONDS = 48 * 60 * 60; // 48 hours
const PURGE_AGE_DAYS = 7;

const BACKOFF_SECONDS = [30, 60, 300, 900, 3600, 21600]; // 30s, 1m, 5m, 15m, 1h, 6h

function getBackoff(attempts: number): number {
  return BACKOFF_SECONDS[Math.min(attempts, BACKOFF_SECONDS.length - 1)];
}

/** Enqueue an outbound webhook for reliable delivery. */
export function enqueueWebhook(endpoint: string, payload: Record<string, unknown>): void {
  const id = generateUuid();
  query(
    'INSERT INTO webhook_outbox (id, endpoint, payload_json) VALUES ($1, $2, $3)',
    [id, endpoint, JSON.stringify(payload)],
  ).catch((err) => {
    log.error('Failed to enqueue:', err instanceof Error ? err.message : err);
  });
}

async function recordRetry(id: string, attempts: number, errorMsg: string): Promise<void> {
  const backoff = getBackoff(attempts);
  await query(
    `UPDATE webhook_outbox SET attempts = attempts + 1, last_error = $1,
     next_retry_at = ${d.intervalSeconds('$2')} WHERE id = $3`,
    [errorMsg, backoff, id],
  );
}

async function processOutbox(): Promise<void> {
  if (!config.managerUrl || !config.subscriptionJwtSecret) return;
  if (!(await acquireJobLock('webhook_outbox', 60))) return;

  try {
    // Abandon entries older than 48 hours
    await query(
      `UPDATE webhook_outbox SET last_error = 'ABANDONED', sent_at = ${d.now()}
       WHERE sent_at IS NULL AND created_at < ${d.secondsAgo(MAX_AGE_SECONDS)}`,
    );

    // Purge old entries
    await query(
      `DELETE FROM webhook_outbox WHERE created_at < ${d.daysAgo(PURGE_AGE_DAYS)}`,
    );

    // Fetch pending entries
    const pending = await query<{
      id: string; endpoint: string; payload_json: string; attempts: number;
    }>(
      `SELECT id, endpoint, payload_json, attempts FROM webhook_outbox
       WHERE sent_at IS NULL AND next_retry_at <= ${d.now()}
       ORDER BY created_at ASC LIMIT $1`,
      [BATCH_SIZE],
    );

    for (const row of pending.rows) {
      const payload = (typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json) as Record<string, unknown>;
      const token = await new jose.SignJWT(payload as jose.JWTPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('5m')
        .sign(getSubscriptionSecretKey());

      try {
        const res = await fetch(`${config.managerUrl}${row.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          signal: AbortSignal.timeout(15_000),
        });

        if (res.ok) {
          await query(`UPDATE webhook_outbox SET sent_at = ${d.now()} WHERE id = $1`, [row.id]);
        } else {
          await recordRetry(row.id, row.attempts, `HTTP ${res.status}`);
        }
      } catch (err) {
        await recordRetry(row.id, row.attempts, err instanceof Error ? err.message : 'Unknown error');
      }
    }
  } catch (err) {
    log.error('Processing failed:', err instanceof Error ? err.message : err);
  } finally {
    await releaseJobLock('webhook_outbox');
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startWebhookOutboxProcessor(): void {
  if (config.selfHosted || !config.managerUrl) return;

  processOutbox();
  intervalId = setInterval(processOutbox, PROCESS_INTERVAL_MS);
}

export function stopWebhookOutboxProcessor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
