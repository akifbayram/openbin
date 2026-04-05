import { ValidationError } from './httpErrors.js';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;
const EMAIL_REGEX = /^[^\s@+]+@[^\s@]+\.[^\s@]+$/;
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/** Strip Unicode control/format characters that enable visual spoofing (RTL overrides, zero-width chars, etc.) */
export function stripUnicodeControl(text: string): string {
  return text.replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF\u00AD]/g, '');
}

export function validateUsername(username: unknown): string {
  if (!username || typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
    throw new ValidationError('Username must be 3-50 characters (alphanumeric and underscores only)');
  }
  return username;
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

export function validatePassword(password: unknown): string {
  if (!password || typeof password !== 'string' || !isStrongPassword(password)) {
    throw new ValidationError('Password must be at least 8 characters with uppercase, lowercase, and a number');
  }
  if (password.length > 72) {
    throw new ValidationError('Password must be at most 72 characters');
  }
  return password;
}

export function validateEmail(email: string): void {
  if (!EMAIL_REGEX.test(email) || email.length > 255) {
    throw new ValidationError('Invalid email address');
  }
}

export function validateDisplayName(displayName: unknown): string {
  const trimmed = stripUnicodeControl(String(displayName).trim());
  if (trimmed.length < 1 || trimmed.length > 100) {
    throw new ValidationError('Display name must be 1-100 characters');
  }
  return trimmed;
}

export function validateBinName(name: unknown): string {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Bin name is required');
  }
  const trimmed = stripUnicodeControl(name.trim());
  if (trimmed.length > 255) {
    throw new ValidationError('Bin name must be 255 characters or less');
  }
  return trimmed;
}

export function validateRetentionDays(value: unknown, label: string): number {
  const v = Number(value);
  if (!Number.isInteger(v) || v < 7 || v > 365) {
    throw new ValidationError(`${label} must be between 7 and 365 days`);
  }
  return v;
}

export function validateRequiredString(value: unknown, fieldName: string): string {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required`);
  }
  return value.trim();
}
