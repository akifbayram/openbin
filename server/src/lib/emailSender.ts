import { generateUuid, query } from '../db.js';
import { config } from './config.js';
import { sendEmail } from './email.js';
import {
  exploreFeaturesEmail,
  passwordResetEmail,
  postTrialEarlyEmail,
  postTrialLateEmail,
  subscriptionConfirmedEmail,
  subscriptionExpiredEmail,
  trialExpiredEmail,
  trialExpiringEmail,
  welcomeEmail,
} from './emailTemplates.js';
import { generateUpgradeUrl, type PlanTier, planLabel } from './planGate.js';

type EmailType = 'welcome' | 'trial_expiring' | 'trial_expired' | 'subscription_confirmed' | 'subscription_expired' | 'explore_features' | 'post_trial_early' | 'post_trial_late' | 'password_reset';

async function wasSentRecently(userId: string, emailType: EmailType): Promise<boolean> {
  const result = await query(
    "SELECT id FROM email_log WHERE user_id = $1 AND email_type = $2 AND sent_at > datetime('now', '-24 hours') LIMIT 1",
    [userId, emailType],
  );
  return result.rows.length > 0;
}

async function logSent(userId: string, emailType: EmailType): Promise<void> {
  await query(
    'INSERT INTO email_log (id, user_id, email_type) VALUES ($1, $2, $3)',
    [generateUuid(), userId, emailType],
  );
}

/**
 * Fire-and-forget email send with dedup. Never throws.
 */
async function safeSend(userId: string, emailType: EmailType, to: string, template: { subject: string; html: string; text: string }): Promise<void> {
  try {
    if (emailType !== 'welcome' && await wasSentRecently(userId, emailType)) return;
    await sendEmail(to, template.subject, template.html, template.text);
    await logSent(userId, emailType);
  } catch (err) {
    console.error(`Failed to send ${emailType} email to user ${userId}:`, err instanceof Error ? err.message : err);
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
