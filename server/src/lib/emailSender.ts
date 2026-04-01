import { generateUuid, isUniqueViolation, query } from '../db.js';
import { config } from './config.js';
import { sendEmail } from './email.js';
import { getTemplateOverride } from './emailTemplateLoader.js';
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
    if (isUniqueViolation(err)) return false;
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

function resolveTemplate(
  type: string,
  vars: Record<string, string>,
  builtIn: { subject: string; html: string; text: string },
): { subject: string; html: string; text: string } {
  return getTemplateOverride(type, vars) ?? builtIn;
}

export function fireWelcomeEmail(userId: string, email: string, displayName: string): void {
  if (config.selfHosted && !config.emailEnabled) return;
  const loginUrl = config.baseUrl ? `${config.baseUrl}/login` : '';
  const vars = { displayName, loginUrl };
  const template = resolveTemplate('welcome', vars, welcomeEmail({ displayName, loginUrl }));
  safeSend(userId, 'welcome', email, template);
}

export function fireSubscriptionConfirmedEmail(userId: string, email: string, displayName: string, plan: PlanTier, activeUntil: string | null): void {
  const vars = { displayName, plan: planLabel(plan), activeUntil: activeUntil ?? '' };
  const template = resolveTemplate('subscription_confirmed', vars, subscriptionConfirmedEmail({ displayName, plan: planLabel(plan), activeUntil }));
  safeSend(userId, 'subscription_confirmed', email, template);
}

export async function fireSubscriptionExpiredEmail(userId: string, email: string, displayName: string): Promise<void> {
  const upgradeUrl = await generateUpgradeUrl(userId, email) || '';
  const vars = { displayName, upgradeUrl };
  const template = resolveTemplate('subscription_expired', vars, subscriptionExpiredEmail({ displayName, upgradeUrl }));
  safeSend(userId, 'subscription_expired', email, template);
}

export async function fireTrialExpiringEmail(userId: string, email: string, displayName: string, expiryDate: string): Promise<void> {
  const upgradeUrl = await generateUpgradeUrl(userId, email) || '';
  const vars = { displayName, expiryDate, upgradeUrl };
  const template = resolveTemplate('trial_expiring', vars, trialExpiringEmail({ displayName, expiryDate, upgradeUrl }));
  safeSend(userId, 'trial_expiring', email, template);
}

export async function fireTrialExpiredEmail(userId: string, email: string, displayName: string): Promise<void> {
  const upgradeUrl = await generateUpgradeUrl(userId, email) || '';
  const vars = { displayName, upgradeUrl };
  const template = resolveTemplate('trial_expired', vars, trialExpiredEmail({ displayName, upgradeUrl }));
  safeSend(userId, 'trial_expired', email, template);
}

export function fireExploreFeaturesEmail(userId: string, email: string, displayName: string): void {
  const dashboardUrl = config.baseUrl ? `${config.baseUrl}/dashboard` : '';
  const vars = { displayName, dashboardUrl };
  const template = resolveTemplate('explore_features', vars, exploreFeaturesEmail({ displayName, dashboardUrl }));
  safeSend(userId, 'explore_features', email, template);
}

export async function firePostTrialEarlyEmail(userId: string, email: string, displayName: string): Promise<void> {
  const upgradeUrl = await generateUpgradeUrl(userId, email) || '';
  const vars = { displayName, upgradeUrl };
  const template = resolveTemplate('post_trial_early', vars, postTrialEarlyEmail({ displayName, upgradeUrl }));
  safeSend(userId, 'post_trial_early', email, template);
}

export async function firePostTrialLateEmail(userId: string, email: string, displayName: string): Promise<void> {
  const upgradeUrl = await generateUpgradeUrl(userId, email) || '';
  const vars = { displayName, upgradeUrl };
  const template = resolveTemplate('post_trial_late', vars, postTrialLateEmail({ displayName, upgradeUrl }));
  safeSend(userId, 'post_trial_late', email, template);
}

export function firePasswordResetEmail(userId: string, email: string, displayName: string, resetUrl: string): void {
  const vars = { displayName, resetUrl };
  const template = resolveTemplate('password_reset', vars, passwordResetEmail({ displayName, resetUrl }));
  safeSend(userId, 'password_reset', email, template);
}

export async function fireSubscriptionExpiringEmail(userId: string, email: string, displayName: string, expiryDate: string): Promise<void> {
  const upgradeUrl = await generateUpgradeUrl(userId, email) || '';
  const vars = { displayName, expiryDate, upgradeUrl };
  const template = resolveTemplate('subscription_expiring', vars, subscriptionExpiringEmail({ displayName, expiryDate, upgradeUrl }));
  safeSend(userId, 'subscription_expiring', email, template);
}

export async function fireDowngradeImpactEmail(userId: string, email: string, displayName: string, impact: DowngradeImpact): Promise<void> {
  const upgradeUrl = await generateUpgradeUrl(userId, email) || '';
  const impactLines: string[] = [];
  if (impact.locationCount > impact.maxLocations) {
    impactLines.push(`You have ${impact.locationCount} locations (Lite allows ${impact.maxLocations}).`);
  }
  for (const loc of impact.overLimitMembers) {
    impactLines.push(`${loc.locationName} has ${loc.memberCount} members (Lite allows ${impact.maxMembersPerLocation}).`);
  }
  if (impact.photoStorageMb > impact.maxPhotoStorageMb) {
    impactLines.push(`Using ${impact.photoStorageMb.toFixed(1)} MB storage (Lite allows ${impact.maxPhotoStorageMb} MB).`);
  }
  const impactHtml = impactLines.length > 0
    ? `<ul>${impactLines.map(l => `<li>${l}</li>`).join('')}</ul>`
    : '';
  const impactText = impactLines.map(l => `- ${l}`).join('\n');
  const vars = { displayName, upgradeUrl, impactHtml, impactText };
  const template = resolveTemplate('downgrade_impact', vars, downgradeImpactEmail({ displayName, impact, upgradeUrl }));
  safeSend(userId, 'downgrade_impact', email, template);
}
