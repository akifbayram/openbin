import { config } from './config.js';
import { TOKEN_EXPIRY_HOURS } from './passwordReset.js';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function logoHtml(): string {
  if (config.baseUrl) return `<img src="${config.baseUrl}/logo-horizontal.png" alt="OpenBin" width="140" height="31" style="display:block;border:0">`;
  return `<span style="font-size:18px;font-weight:700;color:#5e2fe0">OpenBin</span>`;
}

export function wrap(body: string): string {
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

export function btn(href: string, label: string): string {
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

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const h1 = (text: string) => `<h1 style="margin:0 0 20px;padding:0;font-size:22px;font-weight:700;color:#1c1c1e;line-height:1.3">${text}</h1>`;
export const p = (text: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3c3c43">${text}</p>`;
export const greeting = (name: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3c3c43">Hi ${escapeHtml(name)},</p>`;
export const divider = `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tr><td style="height:1px;background:#e8e8ed;font-size:0;line-height:0">&nbsp;</td></tr></table>`;

export function featureCard(emoji: string, title: string, body: string, opts?: { bg?: string; size?: 'sm' | 'lg' }): string {
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
      p('Your account is ready with a <strong>7-day Plus trial</strong> — all features are unlocked.'),
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
      'Welcome to OpenBin! Your account is ready with a 7-day Plus trial — all features are unlocked.',
      '',
      'Organize your physical storage with QR codes, invite team members, and let AI help catalog your items.',
      '',
      `Get started: ${params.loginUrl}`,
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
      `This link expires in ${TOKEN_EXPIRY_HOURS} hours. If you didn't request this, you can safely ignore this email.`,
    ].join('\n'),
  };
}
