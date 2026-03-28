interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;margin:0 auto;padding:32px 16px">
<tr><td style="font-size:22px;font-weight:700;padding-bottom:24px;color:#111">OpenBin</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px">${body}</td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#999;text-align:center">OpenBin &mdash; Organize your stuff</td></tr>
</table>
</body></html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">${label}</a>`;
}

const p = (text: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#333">${text}</p>`;
const greeting = (name: string) => `<p style="margin:0 0 16px;font-size:16px;color:#111">Hi ${name},</p>`;

export function welcomeEmail(params: { displayName: string; loginUrl: string }): EmailTemplate {
  return {
    subject: 'Welcome to OpenBin',
    html: wrap([
      greeting(params.displayName),
      p('Welcome to OpenBin! Your account is ready with a <strong>7-day Pro trial</strong> — all features are unlocked.'),
      p('Organize your physical storage with QR codes, invite team members, and let AI help catalog your items.'),
      `<p style="margin:24px 0 0">${btn(params.loginUrl, 'Get Started')}</p>`,
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
      greeting(params.displayName),
      p(`Your Pro trial ends on <strong>${params.expiryDate}</strong>.`),
      p('When it expires, your account will switch to read-only mode. All your data stays safe — you just won\'t be able to create or edit bins until you subscribe.'),
      `<p style="margin:24px 0 0">${btn(params.upgradeUrl, 'Subscribe Now')}</p>`,
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
      greeting(params.displayName),
      p('Your Pro trial has ended and your account is now in <strong>read-only mode</strong>.'),
      p('All your bins, items, and photos are safe — nothing has been deleted. Subscribe to a plan to continue creating and editing.'),
      `<p style="margin:24px 0 0">${btn(params.upgradeUrl, 'Subscribe Now')}</p>`,
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
      greeting(params.displayName),
      p(`Your <strong>${params.plan}</strong> subscription is now active.${untilLine}`),
      p('All features for your plan are unlocked. Thanks for subscribing!'),
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

export function subscriptionExpiredEmail(params: { displayName: string; upgradeUrl: string }): EmailTemplate {
  return {
    subject: 'Your OpenBin subscription has expired',
    html: wrap([
      greeting(params.displayName),
      p('Your OpenBin subscription has expired and your account is now in <strong>read-only mode</strong>.'),
      p('All your data is safe — nothing has been deleted. Resubscribe to continue creating and editing.'),
      `<p style="margin:24px 0 0">${btn(params.upgradeUrl, 'Resubscribe')}</p>`,
    ].join('')),
    text: [
      `Hi ${params.displayName},`,
      '',
      'Your OpenBin subscription has expired and your account is now in read-only mode.',
      '',
      'All your data is safe — nothing has been deleted. Resubscribe to continue creating and editing.',
      '',
      `Resubscribe: ${params.upgradeUrl}`,
    ].join('\n'),
  };
}
