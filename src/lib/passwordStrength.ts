export const PASSWORD_CHECKS = [
  { key: 'length', label: 'At least 8 characters' },
  { key: 'uppercase', label: 'Uppercase letter' },
  { key: 'lowercase', label: 'Lowercase letter' },
  { key: 'digit', label: 'Number' },
] as const;

export type PasswordCheckKey = (typeof PASSWORD_CHECKS)[number]['key'];
export type PasswordCheckResult = Record<PasswordCheckKey, boolean>;

export function computePasswordChecks(password: string): PasswordCheckResult {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /\d/.test(password),
  };
}

export function allChecksPassing(checks: PasswordCheckResult): boolean {
  return Object.values(checks).every(Boolean);
}
