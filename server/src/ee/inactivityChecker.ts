import { d, query } from '../db.js';
import { requestDeletion } from '../lib/accountDeletion.js';
import { config } from '../lib/config.js';
import { acquireJobLock, releaseJobLock } from '../lib/jobLock.js';
import { createLogger } from '../lib/logger.js';
import { SubStatus } from '../lib/planGate.js';
import { fireInactivityWarning7d, fireInactivityWarning30d } from './lifecycleEmails.js';

const log = createLogger('inactivityChecker');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const INACTIVITY_DAYS = 365;
const WARNING_30D_DAYS = INACTIVITY_DAYS - 30; // 335
const WARNING_7D_DAYS = INACTIVITY_DAYS - 7;   // 358

interface InactiveUser {
  id: string;
  email: string;
  display_name: string;
  last_active_at: string | null;
  created_at: string;
}

export async function checkInactiveUsers(): Promise<void> {
  if (!(await acquireJobLock('inactivity_checker', 7200))) return;
  try {
    const candidates = await query<InactiveUser>(
      `SELECT id, email, display_name, last_active_at, created_at
       FROM users
       WHERE sub_status = $1
         AND deleted_at IS NULL
         AND suspended_at IS NULL
         AND is_admin = FALSE
         AND COALESCE(last_active_at, created_at) <= ${d.daysAgo(WARNING_30D_DAYS)}`,
      [SubStatus.INACTIVE],
    );

    for (const user of candidates.rows) {
      const lastActive = new Date(user.last_active_at ?? user.created_at);
      const daysInactive = Math.floor((Date.now() - lastActive.getTime()) / (24 * 3600_000));

      if (daysInactive >= INACTIVITY_DAYS) {
        try {
          await requestDeletion({
            userId: user.id,
            refundPolicy: 'none',
            initiatedByAdminId: 'system',
            initiatedByAdminName: 'inactivity-checker',
          });
          log.info(`Soft-deleted inactive user ${user.id} (${daysInactive} days inactive)`);
        } catch (err) {
          // Possible failures: sole admin (excluded by SELECT but defensive),
          // sole admin of a shared location, or subscription cancellation
          // failure (rare since sub_status = INACTIVE). Log and skip — the
          // next sweep will retry.
          log.warn(
            `Could not delete inactive user ${user.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      } else if (daysInactive >= WARNING_7D_DAYS && user.email) {
        fireInactivityWarning7d(user.id, user.email, user.display_name, daysInactive);
      } else if (daysInactive >= WARNING_30D_DAYS && user.email) {
        fireInactivityWarning30d(user.id, user.email, user.display_name, daysInactive);
      }
    }
  } catch (err) {
    log.error('Inactivity check failed:', err instanceof Error ? err.message : err);
  } finally {
    await releaseJobLock('inactivity_checker');
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startInactivityChecker(): void {
  if (config.selfHosted) return;

  checkInactiveUsers();
  intervalId = setInterval(checkInactiveUsers, CHECK_INTERVAL_MS);
}

export function stopInactivityChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
