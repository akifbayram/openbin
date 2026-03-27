import { describe, expect, it } from 'vitest';
import './setup.js';
import { validateCodeFormat } from '../lib/binValidation.js';

describe('validateCodeFormat', () => {
  it('accepts valid 6-char uppercase codes', () => {
    expect(() => validateCodeFormat('ABCDEF')).not.toThrow();
  });

  it('accepts 4-char codes', () => {
    expect(() => validateCodeFormat('ABCD')).not.toThrow();
  });

  it('accepts 8-char codes', () => {
    expect(() => validateCodeFormat('ABCD1234')).not.toThrow();
  });

  it('accepts codes with digits', () => {
    expect(() => validateCodeFormat('ABC123')).not.toThrow();
  });

  it('rejects codes shorter than 4 chars', () => {
    expect(() => validateCodeFormat('ABC')).toThrow('Code must be 4-8 alphanumeric characters');
  });

  it('rejects codes longer than 8 chars', () => {
    expect(() => validateCodeFormat('ABCDEFGHI')).toThrow('Code must be 4-8 alphanumeric characters');
  });

  it('rejects codes with special characters', () => {
    expect(() => validateCodeFormat('ABC-DE')).toThrow('Code must be 4-8 alphanumeric characters');
  });

  it('rejects empty string', () => {
    expect(() => validateCodeFormat('')).toThrow('Code must be 4-8 alphanumeric characters');
  });
});
