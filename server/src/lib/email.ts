import { Resend } from 'resend';
import { config } from './config.js';

const isConfigured = config.emailEnabled && !!config.resendApiKey;
const resend = isConfigured ? new Resend(config.resendApiKey!) : null;

let loggedSkip = false;

/**
 * Send an email via Resend. Silently no-ops if email is not configured.
 * NEVER throws — all errors are caught and logged.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<void> {
  if (!resend) {
    if (!loggedSkip) {
      console.log('Email not configured (EMAIL_ENABLED=false or RESEND_API_KEY missing), skipping sends');
      loggedSkip = true;
    }
    return;
  }

  try {
    await resend.emails.send({
      from: config.emailFrom,
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error('Failed to send email:', err instanceof Error ? err.message : err);
  }
}
