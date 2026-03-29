import { generateUuid, query } from '../db.js';
import { config } from './config.js';
import { sendEmail } from './email.js';
import {
  type DowngradeImpact,
  downgradeImpactEmail,
  exploreFeaturesEmail,
  passwordResetEmail,
  postTrialEarlyEmail,
  postTrialLateEmail,
  subscriptionConfirmedEmail,
  subscriptionExpiredEmail,
  subscriptionExpiringEmail,
  trialExpiredEmail,
  trialExpiringEmail,
  welcomeEmail,
} from './emailTemplates.js';
import { createLogger } from './logger.js';
import { generateUpgradeUrl, type PlanTier, planLabel } from './planGate.js';

type EmailType = 'welcome' | 'trial_expiring' | 'trial_expired' | 'subscription_confirmed' | 'subscription_expired' | 'subscription_expiring' | 'downgrade_impact' | 'explore_features' | 'post_trial_early' | 'post_trial_late' | 'password_reset';

const log = createLogger('email');
const SKIP_DEDUP: ReadonlySet<EmailType> = new Set(['welcome', 'password_reset']);

/**
 * Attempt to claim an email send slot atomically.
 * Returns true if this instance won the claim, false if already sent today.
 * SKIP_DEDUP emails bypass the daily unique constraint and always succeed.
 */
async function claimEmailSlot(userId: string, emailType: EmailType, skipDedup: boolean): Promise<boolean> {
  if (skipDedup) return true;
  try {
    await query(
      'INSERT INTO email_log (id, user_id, email_type) VALUES ($1, $2, $3)',
      [generateUuid(), userId, emailType],
    );
    return true;
  } catch (err: unknown) {
    const sqliteErr = err as { code?: string };
    if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE') return false;
    throw err;
  }
}

/**
 * Fire-and-forget email send with atomic dedup. Never throws.
 */
async function safeSend(userId: string, emailType: EmailType, to: string, template: { subject: string; html: string; text: string }): Promise<void> {
  try {
    const claimed = await claimEmailSlot(userId, emailType, SKIP_DEDUP.has(emailType));
    if (!claimed) return;
    await sendEmail(to, template.subject, template.html, template.text);
  } catch (err) {
    log.error(`Failed to send ${emailType} email to user ${userId}:`, err instanceof Error ? err.message : err);
  }
}

export function fireWelcomeEmail(userId: string, email: string, displayName: string): void {
  if (config.selfHosted && !config.emailEnabled) return;
  const loginUrl = config.baseUrl ? `${config.baseUrl}/login` : '';
  safeSend(userId, 'welcome', email, welcomeEmail({ displayName, loginUrl }));
}

export function fireSubscriptionConfirmedEmail(userId: string, email: string, displayName: string, plan: PlanTier, activeUntil: string | null): void {
  safeSend(userId, 'subscription_confirmed', email, subscriptionConfirmedEmail({
    displayName,
    plan: planLabel(plan),
    activeUntil,
  }));
}

export function fireSubscriptionExpiredEmail(userId: string, email: string, displayName: string): void {
  const upgradeUrl = generateUpgradeUrl(userId, email) || '';
  safeSend(userId, 'subscription_expired', email, subscriptionExpiredEmail({ displayName, upgradeUrl }));
}

export function fireTrialExpiringEmail(userId: string, email: string, displayName: string, expiryDate: string): void {
  const upgradeUrl = generateUpgradeUrl(userId, email) || '';
  safeSend(userId, 'trial_expiring', email, trialExpiringEmail({ displayName, expiryDate, upgradeUrl }));
}

export function fireTrialExpiredEmail(userId: string, email: string, displayName: string): void {
  const upgradeUrl = generateUpgradeUrl(userId, email) || '';
  safeSend(userId, 'trial_expired', email, trialExpiredEmail({ displayName, upgradeUrl }));
}

export function fireExploreFeaturesEmail(userId: string, email: string, displayName: string): void {
  const dashboardUrl = config.baseUrl ? `${config.baseUrl}/dashboard` : '';
  safeSend(userId, 'explore_features', email, exploreFeaturesEmail({ displayName, dashboardUrl }));
}

export function firePostTrialEarlyEmail(userId: string, email: string, displayName: string): void {
  const upgradeUrl = generateUpgradeUrl(userId, email) || '';
  safeSend(userId, 'post_trial_early', email, postTrialEarlyEmail({ displayName, upgradeUrl }));
}

export function firePostTrialLateEmail(userId: string, email: string, displayName: string): void {
  const upgradeUrl = generateUpgradeUrl(userId, email) || '';
  safeSend(userId, 'post_trial_late', email, postTrialLateEmail({ displayName, upgradeUrl }));
}

export function firePasswordResetEmail(userId: string, email: string, displayName: string, resetUrl: string): void {
  safeSend(userId, 'password_reset', email, passwordResetEmail({ displayName, resetUrl }));
}

export function fireSubscriptionExpiringEmail(userId: string, email: string, displayName: string, expiryDate: string): void {
  const upgradeUrl = generateUpgradeUrl(userId, email) || '';
  safeSend(userId, 'subscription_expiring', email, subscriptionExpiringEmail({ displayName, expiryDate, upgradeUrl }));
}

export function fireDowngradeImpactEmail(userId: string, email: string, displayName: string, impact: DowngradeImpact): void {
  const upgradeUrl = generateUpgradeUrl(userId, email) || '';
  safeSend(userId, 'downgrade_impact', email, downgradeImpactEmail({ displayName, impact, upgradeUrl }));
}
