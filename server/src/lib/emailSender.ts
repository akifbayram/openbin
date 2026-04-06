import { generateUuid, isUniqueViolation, query } from '../db.js';
import { config } from './config.js';
import { sendEmail } from './email.js';
import { type EmailType, getTemplateOverride } from './emailTemplateLoader.js';
import {
  passwordResetEmail,
  welcomeEmail,
} from './emailTemplates.js';
import { createLogger } from './logger.js';

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
export async function safeSend(userId: string, emailType: EmailType, to: string, template: { subject: string; html: string; text: string }): Promise<void> {
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

export function firePasswordResetEmail(userId: string, email: string, displayName: string, resetUrl: string): void {
  const vars = { displayName, resetUrl };
  const template = resolveTemplate('password_reset', vars, passwordResetEmail({ displayName, resetUrl }));
  safeSend(userId, 'password_reset', email, template);
}
