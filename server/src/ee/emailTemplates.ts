import {
  btn,
  divider,
  type EmailTemplate,
  featureCard,
  greeting,
  h1,
  p,
  wrap,
} from '../lib/emailTemplates.js';

export type { EmailTemplate };

export interface DowngradeImpact {
  locationCount: number;
  maxLocations: number;
  photoStorageMb: number;
  maxPhotoStorageMb: number;
  overLimitMembers: Array<{ locationName: string; memberCount: number }>;
  maxMembersPerLocation: number;
}

export function trialExpiringEmail(params: { displayName: string; expiryDate: string; upgradeUrl: string }): EmailTemplate {
  return {
    subject: 'Your OpenBin trial ends in 3 days',
    html: wrap([
      h1('Your trial ends in 3 days'),
      greeting(params.displayName),
      p(`Your Plus trial ends on <strong>${params.expiryDate}</strong>.`),
      p('When it expires, your account will switch to read-only mode. All your data stays safe — you just won\'t be able to create or edit bins until you subscribe.'),
      `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tr><td align="center" style="padding-top:20px">
<div style="border-top:2px solid #ff9500;width:60px;margin:0 auto 8px"></div>
<p style="margin:0;font-size:12px;color:#ff9500;font-weight:600">3 days remaining</p>
</td></tr></table>`,
      divider,
      btn(params.upgradeUrl, 'Subscribe Now'),
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      `Your Plus trial ends on ${params.expiryDate}.`,
      '',
      'When it expires, your account will switch to read-only mode. All your data stays safe — you just won\'t be able to create or edit bins until you subscribe.',
      '',
      `Subscribe now: ${params.upgradeUrl}`,
    ].join('\n'),
  };
}

export function trialExpiredEmail(params: { displayName: string; upgradeUrl: string }): EmailTemplate {
  return {
    subject: 'Your OpenBin trial has ended',
    html: wrap([
      h1('Your trial has ended'),
      greeting(params.displayName),
      p('Your Plus trial has ended and your account is now in <strong>read-only mode</strong>.'),
      p('All your bins, items, and photos are safe — nothing has been deleted. Subscribe to a plan to continue creating and editing.'),
      divider,
      btn(params.upgradeUrl, 'Subscribe Now'),
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      'Your Plus trial has ended and your account is now in read-only mode.',
      '',
      'All your bins, items, and photos are safe — nothing has been deleted. Subscribe to a plan to continue creating and editing.',
      '',
      `Subscribe now: ${params.upgradeUrl}`,
    ].join('\n'),
  };
}

export function subscriptionConfirmedEmail(params: { displayName: string; plan: string; activeUntil: string | null }): EmailTemplate {
  const untilLine = params.activeUntil ? ` Your subscription is active until <strong>${params.activeUntil}</strong>.` : '';
  const untilText = params.activeUntil ? ` Your subscription is active until ${params.activeUntil}.` : '';
  return {
    subject: 'Your OpenBin subscription is active',
    html: wrap([
      `<table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tr>
<td valign="middle" style="padding-right:10px"><div style="width:28px;height:28px;border-radius:50%;background:#34c759;text-align:center;line-height:28px;color:#ffffff;font-size:16px;font-weight:700">&#10003;</div></td>
<td valign="middle"><h1 style="margin:0;padding:0;font-size:22px;font-weight:700;color:#1c1c1e;line-height:1.3">Subscription active</h1></td>
</tr></table>`,
      `<div style="height:20px"></div>`,
      greeting(params.displayName),
      p(`Your <strong>${params.plan}</strong> subscription is now active.${untilLine}`),
      `<p style="margin:0;font-size:15px;line-height:1.6;color:#3c3c43">All features for your plan are unlocked. Thanks for subscribing!</p>`,
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      `Your ${params.plan} subscription is now active.${untilText}`,
      '',
      'All features for your plan are unlocked. Thanks for subscribing!',
    ].join('\n'),
  };
}

export function exploreFeaturesEmail(params: { displayName: string; dashboardUrl: string }): EmailTemplate {
  const cardOpts = { bg: '#f8f6fe', size: 'sm' as const };
  return {
    subject: 'Tips to get the most out of OpenBin',
    html: wrap([
      h1('Tips to get organized'),
      greeting(params.displayName),
      p('You\'ve been using OpenBin for a couple of days — here are some features that can help you get even more organized:'),
      `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;margin:8px 0">
<tr>
<td width="50%" valign="top" style="padding:0 6px 12px 0">${featureCard('📦', 'QR Labels', 'Print and stick QR codes on your bins for instant scanning', cardOpts)}</td>
<td width="50%" valign="top" style="padding:0 0 12px 6px">${featureCard('🤖', 'AI Recognition', 'Snap a photo and let AI catalog your items', cardOpts)}</td>
</tr>
<tr>
<td width="50%" valign="top" style="padding:0 6px 0 0">${featureCard('👥', 'Team Sharing', 'Invite others to your location so everyone stays in sync', cardOpts)}</td>
<td width="50%" valign="top" style="padding:0 0 0 6px">${featureCard('🔍', 'Bin Search', 'Find any item across all your bins in seconds', cardOpts)}</td>
</tr>
</table>`,
      divider,
      btn(params.dashboardUrl, 'Explore Your Dashboard'),
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      'You\'ve been using OpenBin for a couple of days — here are some features that can help you get even more organized:',
      '',
      '- QR Labels — Print and stick QR codes on your bins for instant scanning',
      '- AI Item Recognition — Snap a photo and let AI catalog your items',
      '- Team Sharing — Invite others to your location so everyone stays in sync',
      '- Bin Search — Find any item across all your bins in seconds',
      '',
      `Explore your dashboard: ${params.dashboardUrl}`,
    ].join('\n'),
  };
}

export function postTrialEarlyEmail(params: { displayName: string; upgradeUrl: string }): EmailTemplate {
  return {
    subject: 'Your OpenBin data is waiting',
    html: wrap([
      h1('Your data is waiting'),
      greeting(params.displayName),
      p('Your trial ended a couple of days ago, but all your bins, items, and photos are <strong>safe in read-only mode</strong> — nothing has been deleted.'),
      p('Subscribe to pick up right where you left off and unlock full editing again.'),
      divider,
      btn(params.upgradeUrl, 'Subscribe Now'),
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      'Your trial ended a couple of days ago, but all your bins, items, and photos are safe in read-only mode — nothing has been deleted.',
      '',
      'Subscribe to pick up right where you left off and unlock full editing again.',
      '',
      `Subscribe now: ${params.upgradeUrl}`,
    ].join('\n'),
  };
}

export function postTrialLateEmail(params: { displayName: string; upgradeUrl: string }): EmailTemplate {
  return {
    subject: 'Still organizing? Unlock OpenBin again',
    html: wrap([
      h1('Still organizing?'),
      greeting(params.displayName),
      p('It\'s been a while since your trial ended. Your data is still here — bins, items, photos, everything.'),
      p('Subscribe any time to pick up exactly where you left off. No setup needed.'),
      divider,
      btn(params.upgradeUrl, 'Subscribe Now'),
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      'It\'s been a while since your trial ended. Your data is still here — bins, items, photos, everything.',
      '',
      'Subscribe any time to pick up exactly where you left off. No setup needed.',
      '',
      `Subscribe now: ${params.upgradeUrl}`,
    ].join('\n'),
  };
}

export function subscriptionExpiredEmail(params: { displayName: string; upgradeUrl: string }): EmailTemplate {
  return {
    subject: 'Your OpenBin subscription has expired',
    html: wrap([
      h1('Subscription expired'),
      greeting(params.displayName),
      p('Your OpenBin subscription has expired and your account is now in <strong>read-only mode</strong>.'),
      p('<strong>Your data is safe</strong> — all your bins, items, photos, and settings are preserved. Nothing has been deleted.'),
      p('Resubscribe to resume creating and editing.'),
      divider,
      btn(params.upgradeUrl, 'Resubscribe'),
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      'Your OpenBin subscription has expired and your account is now in read-only mode.',
      '',
      'Your data is safe — all your bins, items, photos, and settings are preserved. Nothing has been deleted.',
      '',
      'Resubscribe to resume creating and editing.',
      '',
      `Resubscribe: ${params.upgradeUrl}`,
    ].join('\n'),
  };
}

export function subscriptionExpiringEmail(params: { displayName: string; expiryDate: string; upgradeUrl: string }): EmailTemplate {
  return {
    subject: 'Your OpenBin subscription expires in 3 days',
    html: wrap([
      h1('Your subscription expires soon'),
      greeting(params.displayName),
      p(`Your OpenBin subscription expires on <strong>${params.expiryDate}</strong>.`),
      p('When it expires, your account will switch to read-only mode. All your data stays safe — you just won\'t be able to create or edit until you renew.'),
      `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tr><td align="center" style="padding-top:20px">
<div style="border-top:2px solid #ff9500;width:60px;margin:0 auto 8px"></div>
<p style="margin:0;font-size:12px;color:#ff9500;font-weight:600">3 days remaining</p>
</td></tr></table>`,
      divider,
      btn(params.upgradeUrl, 'Renew Now'),
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      `Your OpenBin subscription expires on ${params.expiryDate}.`,
      '',
      'When it expires, your account will switch to read-only mode. All your data stays safe — you just won\'t be able to create or edit until you renew.',
      '',
      `Renew now: ${params.upgradeUrl}`,
    ].join('\n'),
  };
}

export function downgradeImpactEmail(params: { displayName: string; impact: DowngradeImpact; upgradeUrl: string }): EmailTemplate {
  const { impact } = params;
  const lines: string[] = [];

  if (impact.locationCount > impact.maxLocations) {
    lines.push(`You have ${impact.locationCount} locations (Lite allows ${impact.maxLocations}) — all locations are now read-only until you reduce to ${impact.maxLocations}.`);
  }
  if (impact.overLimitMembers.length > 0) {
    for (const loc of impact.overLimitMembers) {
      lines.push(`${loc.locationName} has ${loc.memberCount} members (Lite allows ${impact.maxMembersPerLocation}) — extra members are now view-only.`);
    }
  }
  if (impact.photoStorageMb > impact.maxPhotoStorageMb) {
    lines.push(`You're using ${impact.photoStorageMb.toFixed(1)} MB of photo storage (Lite allows ${impact.maxPhotoStorageMb} MB) — new uploads are blocked.`);
  }

  const impactHtml = lines.length > 0
    ? `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6;color:#3c3c43">${lines.map(l => `<li style="margin-bottom:8px">${l}</li>`).join('')}</ul>`
    : '';

  return {
    subject: 'Your OpenBin plan has changed to Lite',
    html: wrap([
      h1('Your plan has changed'),
      greeting(params.displayName),
      p('Your OpenBin plan has been changed to <strong>Lite</strong>.'),
      p('<strong>Your data is safe</strong> — nothing has been deleted. Here\'s what\'s affected based on your current usage:'),
      impactHtml,
      p('Pro-only features (AI recognition, API keys, custom fields, reorganization, webhooks) are now restricted.'),
      divider,
      btn(params.upgradeUrl, 'Upgrade to Pro'),
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      'Your OpenBin plan has been changed to Lite.',
      '',
      'Your data is safe — nothing has been deleted. Here\'s what\'s affected:',
      '',
      ...lines.map(l => `- ${l}`),
      '',
      'Pro-only features (AI recognition, API keys, custom fields, reorganization, webhooks) are now restricted.',
      '',
      `Upgrade to Pro: ${params.upgradeUrl}`,
    ].join('\n'),
  };
}
