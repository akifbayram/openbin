import { d, query } from '../db.js';
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
  email: string | null;
  username: string;
  display_name: string;
  last_active_at: string | null;
  created_at: string;
}

export async function checkInactiveUsers(): Promise<void> {
  if (!(await acquireJobLock('inactivity_checker', 7200))) return;
  try {
    const candidates = await query<InactiveUser>(
      `SELECT id, email, username, display_name, last_active_at, created_at
       FROM users
       WHERE sub_status = $1
         AND deleted_at IS NULL
         AND suspended_at IS NULL
         AND is_admin = 0
         AND COALESCE(last_active_at, created_at) <= ${d.daysAgo(WARNING_30D_DAYS)}`,
      [SubStatus.INACTIVE],
    );

    for (const user of candidates.rows) {
      const lastActive = new Date(user.last_active_at ?? user.created_at);
      const daysInactive = Math.floor((Date.now() - lastActive.getTime()) / (24 * 3600_000));

      if (daysInactive >= INACTIVITY_DAYS) {
        // Soft-delete — userCleanup job handles hard deletion
        await query(
          `UPDATE users SET deleted_at = ${d.now()}, updated_at = ${d.now()} WHERE id = $1`,
          [user.id],
        );
        log.info(`Soft-deleted inactive user ${user.id} (${daysInactive} days inactive)`);
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
