import { describe, expect, it } from 'vitest';
import {
  isStrongPassword,
  validateBinName,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateRequiredString,
  validateRetentionDays,
  validateUsername,
} from '../validation.js';

describe('validateUsername', () => {
  it('accepts a valid username', () => {
    expect(validateUsername('alice_42')).toBe('alice_42');
  });

  it('rejects too-short usernames', () => {
    expect(() => validateUsername('ab')).toThrow();
  });

  it('rejects too-long usernames', () => {
    expect(() => validateUsername('a'.repeat(51))).toThrow();
  });

  it('rejects special characters', () => {
    expect(() => validateUsername('alice!')).toThrow();
  });

  it('rejects empty / null / non-string', () => {
    expect(() => validateUsername('')).toThrow();
    expect(() => validateUsername(null)).toThrow();
    expect(() => validateUsername(123)).toThrow();
  });
});

describe('isStrongPassword', () => {
  it('returns true for a strong password', () => {
    expect(isStrongPassword('Abcdef1!')).toBe(true);
  });

  it('returns false when missing uppercase', () => {
    expect(isStrongPassword('abcdef1!')).toBe(false);
  });

  it('returns false when missing a digit', () => {
    expect(isStrongPassword('Abcdefgh')).toBe(false);
  });

  it('returns false when too short', () => {
    expect(isStrongPassword('Ab1')).toBe(false);
  });
});

describe('validatePassword', () => {
  it('returns the password when valid', () => {
    expect(validatePassword('Secret1x')).toBe('Secret1x');
  });

  it('throws for a weak password', () => {
    expect(() => validatePassword('short')).toThrow();
  });

  it('throws for non-string input', () => {
    expect(() => validatePassword(null)).toThrow();
    expect(() => validatePassword(12345678)).toThrow();
  });
});

describe('validateEmail', () => {
  it('accepts a valid email', () => {
    expect(() => validateEmail('a@b.co')).not.toThrow();
  });

  it('rejects missing @', () => {
    expect(() => validateEmail('invalid')).toThrow();
  });

  it('rejects emails exceeding 255 characters', () => {
    expect(() => validateEmail(`${'a'.repeat(251)}@b.co`)).toThrow();
  });
});

describe('validateDisplayName', () => {
  it('returns trimmed display name', () => {
    expect(validateDisplayName('  Alice  ')).toBe('Alice');
  });

  it('throws for empty string', () => {
    expect(() => validateDisplayName('   ')).toThrow();
  });

  it('throws when too long', () => {
    expect(() => validateDisplayName('a'.repeat(101))).toThrow();
  });
});

describe('validateBinName', () => {
  it('returns trimmed bin name', () => {
    expect(validateBinName(' Kitchen ')).toBe('Kitchen');
  });

  it('throws for empty / missing name', () => {
    expect(() => validateBinName('')).toThrow();
    expect(() => validateBinName(null)).toThrow();
  });

  it('throws when too long', () => {
    expect(() => validateBinName('x'.repeat(256))).toThrow();
  });
});

describe('validateRetentionDays', () => {
  it('returns the number for a valid value', () => {
    expect(validateRetentionDays(30, 'Retention')).toBe(30);
  });

  it('throws below minimum (7)', () => {
    expect(() => validateRetentionDays(3, 'Retention')).toThrow();
  });

  it('throws above maximum (365)', () => {
    expect(() => validateRetentionDays(400, 'Retention')).toThrow();
  });

  it('throws for non-integer', () => {
    expect(() => validateRetentionDays(10.5, 'Retention')).toThrow();
  });
});

describe('validateRequiredString', () => {
  it('returns trimmed value when valid', () => {
    expect(validateRequiredString(' hello ', 'field')).toBe('hello');
  });

  it('throws for empty string', () => {
    expect(() => validateRequiredString('', 'field')).toThrow();
  });

  it('throws for non-string', () => {
    expect(() => validateRequiredString(42, 'field')).toThrow();
  });
});
