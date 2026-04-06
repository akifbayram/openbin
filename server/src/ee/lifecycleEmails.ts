import { config } from '../lib/config.js';
import { resolveTemplate, safeSend } from '../lib/emailSender.js';
import { generateUpgradeUrl, type PlanTier, planLabel } from '../lib/planGate.js';
import {
  type DowngradeImpact,
  downgradeImpactEmail,
  exploreFeaturesEmail,
  postTrialEarlyEmail,
  postTrialLateEmail,
  subscriptionConfirmedEmail,
  subscriptionExpiredEmail,
  subscriptionExpiringEmail,
  trialExpiredEmail,
  trialExpiringEmail,
} from './emailTemplates.js';

export type { DowngradeImpact };

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
