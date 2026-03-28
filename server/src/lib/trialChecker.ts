import { query } from '../db.js';
import { config } from './config.js';
import { fireTrialExpiredEmail, fireTrialExpiringEmail } from './emailSender.js';
import { SubStatus } from './planGate.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface TrialUser {
  id: string;
  email: string;
  display_name: string;
  active_until: string;
}

async function checkTrials(): Promise<void> {
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
        "UPDATE users SET sub_status = $1, updated_at = datetime('now') WHERE id = $2",
        [SubStatus.INACTIVE, user.id],
      );
    }
  } catch (err) {
    console.error('Trial check failed:', err instanceof Error ? err.message : err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startTrialChecker(): void {
  if (config.selfHosted && !config.emailEnabled) return;
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
