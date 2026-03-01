import { describe, expect, it } from 'vitest';
import './setup.js';
import { derivePrefix, generateShortCode } from '../lib/shortCode.js';

describe('derivePrefix', () => {
  it('derives acronym from 3+ words', () => {
    expect(derivePrefix('Kitchen Cleaning Supplies')).toBe('KCS');
  });

  it('derives acronym from 4+ words (uses first 3)', () => {
    expect(derivePrefix('Big Red Storage Box')).toBe('BRS');
  });

  it('handles 2 words — first letters + consonant of longer', () => {
    const result = derivePrefix('Holiday Decorations');
    expect(result).toHaveLength(3);
    // H + D + first consonant after first char of "DECORATIONS" = 'C'
    expect(result).toBe('HDC');
  });

  it('handles single word with enough consonants', () => {
    expect(derivePrefix('Christmas')).toBe('CHR');
  });

  it('handles single word — falls back to first 3 letters if < 3 consonants', () => {
    expect(derivePrefix('Aoi')).toBe('AOI');
  });

  it('filters stop words', () => {
    // "The Box Of Stuff" → filter "The", "Of" → "Box", "Stuff" → 2-word path
    const result = derivePrefix('The Box Of Stuff');
    expect(result).toHaveLength(3);
    expect(result).toMatch(/^[A-Z]{3}$/);
  });

  it('uses original words if all are stop words', () => {
    const result = derivePrefix('The A An');
    expect(result).toHaveLength(3);
    expect(result).toBe('TAA');
  });

  it('strips accents', () => {
    // "Résumé Files" → "RESUME FILES" → 2 words
    // Longer = RESUME (6 chars), first consonant after R is S
    expect(derivePrefix('Résumé Files')).toBe('RFS');
  });

  it('strips non-alpha characters', () => {
    expect(derivePrefix('Box #1 - Stuff!')).toBe('BST');
  });

  it('returns BIN for empty string', () => {
    expect(derivePrefix('')).toBe('BIN');
  });

  it('returns BIN for whitespace-only', () => {
    expect(derivePrefix('   ')).toBe('BIN');
  });

  it('handles 1-char word', () => {
    const result = derivePrefix('X');
    expect(result).toHaveLength(3);
    expect(result).toBe('XXX');
  });

  it('handles 2-char word', () => {
    const result = derivePrefix('AB');
    expect(result).toHaveLength(3);
    expect(result).toBe('ABX');
  });

  it('handles numbers-only name', () => {
    expect(derivePrefix('123')).toBe('BIN');
  });
});

describe('generateShortCode', () => {
  it('returns 6-char all-letter code when called without args', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z]{6}$/);
  });

  it('returns prefix + 3 random letters when name is provided', () => {
    const code = generateShortCode('Kitchen Supplies');
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z]{6}$/);
    expect(code.slice(0, 3)).toBe('KSP');
  });

  it('uses provided prefix over derived one', () => {
    const code = generateShortCode('Kitchen Stuff', 'ABC');
    expect(code).toMatch(/^ABC[A-Z]{3}$/);
  });

  it('cleans prefix input — strips non-alpha and uppercases', () => {
    const code = generateShortCode('Test', 'a1bc');
    // 'a1bc' → strip digits → 'ABC' (first 3 alpha chars)
    expect(code).toMatch(/^ABC[A-Z]{3}$/);
  });

  it('falls back to name-derived prefix when cleaned prefix is too short', () => {
    const code = generateShortCode('Tools', 'a1');
    // 'a1' → strip digits → 'A' (only 1 char, too short)
    // Falls back to derivePrefix('Tools') → 'TLS'
    expect(code).toMatch(/^TLS[A-Z]{3}$/);
  });

  it('falls back to random code when no name and prefix is invalid', () => {
    const code = generateShortCode(undefined, '12');
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z]{6}$/);
  });

  it('generates different codes on subsequent calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateShortCode('Test Bin'));
    }
    // With random suffixes, extremely unlikely all 20 are the same
    expect(codes.size).toBeGreaterThan(1);
  });
});
