import { config } from './config.js';
import { TOKEN_EXPIRY_HOURS } from './passwordReset.js';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function logoHtml(): string {
  if (config.baseUrl) return `<img src="${config.baseUrl}/logo-horizontal.png" alt="OpenBin" width="140" height="31" style="display:block;border:0">`;
  return `<span style="font-size:18px;font-weight:700;color:#5e2fe0">OpenBin</span>`;
}

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f5f5">
<tr><td align="center" style="padding:40px 16px">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%">
<tr><td style="padding-bottom:32px">${logoHtml()}</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tr><td style="height:4px;background:#5e2fe0;font-size:0;line-height:0">&nbsp;</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tr><td style="padding:36px 40px">${body}</td></tr></table>
</td></tr>
<tr><td style="padding-top:24px;text-align:center;font-size:12px;color:#6d6d72"><span style="font-weight:600">OpenBin</span> &mdash; Organize your stuff</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function btn(href: string, label: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tr><td align="center" style="padding-top:28px">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:42px;v-text-anchor:middle;width:220px;" arcsize="14%" stroke="f" fillcolor="#5e2fe0">
<w:anchorlock/>
<center>
<![endif]-->
<a href="${href}" style="display:inline-block;background:#5e2fe0;color:#ffffff;padding:13px 32px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${label}</a>
<!--[if mso]>
</center>
</v:roundrect>
<![endif]-->
</td></tr></table>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const h1 = (text: string) => `<h1 style="margin:0 0 20px;padding:0;font-size:22px;font-weight:700;color:#1c1c1e;line-height:1.3">${text}</h1>`;
const p = (text: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3c3c43">${text}</p>`;
const greeting = (name: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3c3c43">Hi ${escapeHtml(name)},</p>`;
const divider = `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tr><td style="height:1px;background:#e8e8ed;font-size:0;line-height:0">&nbsp;</td></tr></table>`;

function featureCard(emoji: string, title: string, body: string, opts?: { bg?: string; size?: 'sm' | 'lg' }): string {
  const iconSize = opts?.size === 'sm' ? 28 : 40;
  const fontSize = opts?.size === 'sm' ? 14 : 18;
  const bg = opts?.bg ?? 'transparent';
  const inner = [
    `<div style="width:${iconSize}px;height:${iconSize}px;border-radius:50%;background:#f0ebfc;text-align:center;line-height:${iconSize}px;font-size:${fontSize}px;margin:0 auto 8px">${emoji}</div>`,
    `<p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#1c1c1e">${title}</p>`,
    `<p style="margin:0;font-size:12px;color:#6d6d72;line-height:1.4">${body}</p>`,
  ].join('');
  if (bg !== 'transparent') {
    return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;background:${bg};border-radius:6px"><tr><td style="padding:12px">${inner}</td></tr></table>`;
  }
  return inner;
}

export function welcomeEmail(params: { displayName: string; loginUrl: string }): EmailTemplate {
  return {
    subject: 'Welcome to OpenBin',
    html: wrap([
      h1('Welcome to OpenBin'),
      greeting(params.displayName),
      p('Your account is ready with a <strong>7-day Pro trial</strong> — all features are unlocked.'),
      `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;margin:24px 0 8px"><tr>
<td width="33%" align="center" valign="top" style="padding:0 8px 0 0">${featureCard('📦', 'QR Labels', 'Print codes for instant scanning')}</td>
<td width="33%" align="center" valign="top" style="padding:0 4px">${featureCard('🤖', 'AI Recognition', 'Photo-based item cataloging')}</td>
<td width="33%" align="center" valign="top" style="padding:0 0 0 8px">${featureCard('👥', 'Team Sharing', 'Invite others and stay in sync')}</td>
</tr></table>`,
      divider,
      btn(params.loginUrl, 'Get Started'),
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      'Welcome to OpenBin! Your account is ready with a 7-day Pro trial — all features are unlocked.',
      '',
      'Organize your physical storage with QR codes, invite team members, and let AI help catalog your items.',
      '',
      `Get started: ${params.loginUrl}`,
    ].join('\n'),
  };
}

export function trialExpiringEmail(params: { displayName: string; expiryDate: string; upgradeUrl: string }): EmailTemplate {
  return {
    subject: 'Your OpenBin trial ends in 3 days',
    html: wrap([
      h1('Your trial ends in 3 days'),
      greeting(params.displayName),
      p(`Your Pro trial ends on <strong>${params.expiryDate}</strong>.`),
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
      `Your Pro trial ends on ${params.expiryDate}.`,
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
      p('Your Pro trial has ended and your account is now in <strong>read-only mode</strong>.'),
      p('All your bins, items, and photos are safe — nothing has been deleted. Subscribe to a plan to continue creating and editing.'),
      divider,
      btn(params.upgradeUrl, 'Subscribe Now'),
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      'Your Pro trial has ended and your account is now in read-only mode.',
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

export function passwordResetEmail(params: { displayName: string; resetUrl: string }): EmailTemplate {
  return {
    subject: 'Reset your OpenBin password',
    html: wrap([
      `<div style="margin:0 0 16px"><div style="width:40px;height:40px;border-radius:50%;background:#f0ebfc;text-align:center;line-height:40px;font-size:18px">&#128274;</div></div>`,
      h1('Reset your password'),
      greeting(params.displayName),
      p('A password reset was requested for your account. Click the button below to set a new password.'),
      divider,
      btn(params.resetUrl, 'Reset Password'),
      `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tr><td style="padding-top:20px"><div style="background:#f5f5f5;border-radius:6px;padding:12px 16px;text-align:center;font-size:13px;color:#6d6d72">This link expires in ${TOKEN_EXPIRY_HOURS} hours</div></td></tr></table>`,
      `<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#3c3c43">If you didn't request this, you can safely ignore this email.</p>`,
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      'A password reset was requested for your account. Use the link below to set a new password.',
      '',
      `Reset password: ${params.resetUrl}`,
      '',
      'This link expires in ${TOKEN_EXPIRY_HOURS} hours. If you didn\'t request this, you can safely ignore this email.',
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

export interface DowngradeImpact {
  locationCount: number;
  maxLocations: number;
  photoStorageMb: number;
  maxPhotoStorageMb: number;
  overLimitMembers: Array<{ locationName: string; memberCount: number }>;
  maxMembersPerLocation: number;
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
