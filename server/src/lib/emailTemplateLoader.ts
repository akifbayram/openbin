import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { safePath } from './pathSafety.js';

const log = createLogger('emailTemplateLoader');

interface RawTemplate {
  subject: string;
  html: string;
  text: string;
}

const overrides = new Map<string, RawTemplate>();

export const EMAIL_TYPES = [
  'welcome', 'trial_expiring', 'trial_expired',
  'subscription_confirmed', 'subscription_expired', 'subscription_expiring',
  'explore_features', 'post_trial_early', 'post_trial_late',
  'password_reset', 'downgrade_impact',
] as const;

export type EmailType = (typeof EMAIL_TYPES)[number];

const VALID_TYPES: ReadonlySet<string> = new Set(EMAIL_TYPES);

export function loadEmailTemplates(): void {
  overrides.clear();
  const dir = config.emailTemplateDir;
  if (!dir) return;

  let files: string[];
  try {
    files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch (err) {
    log.warn(`Failed to read email template directory "${dir}":`, err instanceof Error ? err.message : err);
    return;
  }

  for (const file of files) {
    const type = path.basename(file, '.json');
    if (!VALID_TYPES.has(type)) {
      log.warn(`Skipping unknown email template type: ${file}`);
      continue;
    }
    const filePath = safePath(dir, file);
    if (!filePath) {
      log.warn(`Skipping email template with unsafe path: ${file}`);
      continue;
    }
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
      if (typeof raw.subject !== 'string' || typeof raw.html !== 'string' || typeof raw.text !== 'string') {
        log.warn(`Email template "${file}" missing required fields (subject, html, text), skipping`);
        continue;
      }
      overrides.set(type, { subject: raw.subject, html: raw.html, text: raw.text });
    } catch (err) {
      log.warn(`Failed to parse email template "${file}":`, err instanceof Error ? err.message : err);
    }
  }

  if (overrides.size > 0) {
    log.info(`Loaded ${overrides.size} email template override(s): ${[...overrides.keys()].join(', ')}`);
  }
}

function substituteVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in vars ? vars[key] : match;
  });
}

export function getTemplateOverride(
  type: string,
  vars: Record<string, string>,
): { subject: string; html: string; text: string } | null {
  const tpl = overrides.get(type);
  if (!tpl) return null;
  return {
    subject: substituteVars(tpl.subject, vars),
    html: substituteVars(tpl.html, vars),
    text: substituteVars(tpl.text, vars),
  };
}

/** Visible for testing. */
export function _clearOverrides(): void {
  overrides.clear();
}
