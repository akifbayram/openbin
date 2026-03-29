import { Resend } from 'resend';
import { config } from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('email');

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
      log.info('Email not configured (EMAIL_ENABLED=false or RESEND_API_KEY missing), skipping sends');
      loggedSkip = true;
    }
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: config.emailFrom,
      to,
      subject,
      html,
      text,
    });
    if (error) {
      throw new Error(`${error.name}: ${error.message}`);
    }
  } catch (err) {
    log.error('Failed to send email:', err instanceof Error ? err.message : err);
  }
}
