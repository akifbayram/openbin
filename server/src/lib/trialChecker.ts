import { query } from '../db.js';
import { config } from './config.js';
import { fireExploreFeaturesEmail, firePostTrialEarlyEmail, firePostTrialLateEmail, fireSubscriptionExpiringEmail, fireTrialExpiredEmail, fireTrialExpiringEmail } from './emailSender.js';
import { acquireJobLock, releaseJobLock } from './jobLock.js';
import { createLogger } from './logger.js';
import { SubStatus } from './planGate.js';

const log = createLogger('trialChecker');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface TrialUser {
  id: string;
  email: string;
  display_name: string;
  active_until: string;
}

async function checkTrials(): Promise<void> {
  if (!(await acquireJobLock('trial_checker', 7200))) return;
  try {
    // Trial expiring in 3 days
    const expiring = await query<TrialUser>(
      `SELECT id, email, display_name, active_until FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until > datetime('now') AND active_until <= datetime('now', '+3 days')
       AND email IS NOT NULL`,
      [SubStatus.TRIAL],
    );
    for (const user of expiring.rows) {
      fireTrialExpiringEmail(user.id, user.email, user.display_name, user.active_until.split('T')[0]);
    }

    // Paid subscription expiring in 3 days
    const subExpiring = await query<TrialUser>(
      `SELECT id, email, display_name, active_until FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until > datetime('now') AND active_until <= datetime('now', '+3 days')
       AND email IS NOT NULL`,
      [SubStatus.ACTIVE],
    );
    for (const user of subExpiring.rows) {
      fireSubscriptionExpiringEmail(user.id, user.email, user.display_name, user.active_until.split('T')[0]);
    }

    // Trial expired
    const expired = await query<TrialUser>(
      `SELECT id, email, display_name, active_until FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until <= datetime('now')
       AND email IS NOT NULL`,
      [SubStatus.TRIAL],
    );
    for (const user of expired.rows) {
      fireTrialExpiredEmail(user.id, user.email, user.display_name);
      await query(
        "UPDATE users SET sub_status = $1, previous_sub_status = $2, updated_at = datetime('now') WHERE id = $3",
        [SubStatus.INACTIVE, SubStatus.TRIAL, user.id],
      );
    }

    // Explore features — 2 days after signup (trial or active users)
    const exploreUsers = await query<TrialUser>(
      `SELECT id, email, display_name, active_until FROM users
       WHERE sub_status IN ($1, $2)
       AND created_at <= datetime('now', '-2 days')
       AND created_at > datetime('now', '-3 days')
       AND email IS NOT NULL`,
      [SubStatus.TRIAL, SubStatus.ACTIVE],
    );
    for (const user of exploreUsers.rows) {
      fireExploreFeaturesEmail(user.id, user.email, user.display_name);
    }

    // Post-trial early — 2 days after trial expires (day 9)
    const postTrialEarly = await query<TrialUser>(
      `SELECT id, email, display_name, active_until FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until <= datetime('now', '-2 days')
       AND active_until > datetime('now', '-3 days')
       AND email IS NOT NULL`,
      [SubStatus.INACTIVE],
    );
    for (const user of postTrialEarly.rows) {
      firePostTrialEarlyEmail(user.id, user.email, user.display_name);
    }

    // Post-trial late — 7 days after trial expires (day 14)
    const postTrialLate = await query<TrialUser>(
      `SELECT id, email, display_name, active_until FROM users
       WHERE sub_status = $1 AND active_until IS NOT NULL
       AND active_until <= datetime('now', '-7 days')
       AND active_until > datetime('now', '-8 days')
       AND email IS NOT NULL`,
      [SubStatus.INACTIVE],
    );
    for (const user of postTrialLate.rows) {
      firePostTrialLateEmail(user.id, user.email, user.display_name);
    }
  } catch (err) {
    log.error('Trial check failed:', err instanceof Error ? err.message : err);
  } finally {
    await releaseJobLock('trial_checker');
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startTrialChecker(): void {
  if (config.selfHosted) return;
  if (!config.emailEnabled) return;

  // Run immediately, then every hour
  checkTrials();
  intervalId = setInterval(checkTrials, CHECK_INTERVAL_MS);
}

export function stopTrialChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
