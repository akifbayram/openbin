import { describe, it, expect } from 'vitest';
import './setup.js';
import { derivePrefix, generateShortCode } from '../lib/shortCode.js';
import { getDb } from '../db.js';

function seedBin(shortCode: string) {
  const db = getDb();
  // Ensure parent records exist (idempotent)
  db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES ('u1', 'testuser', 'hash')").run();
  db.prepare("INSERT OR IGNORE INTO locations (id, name, invite_code, created_by) VALUES ('loc1', 'Test', 'INV123', 'u1')").run();
  db.prepare("INSERT OR IGNORE INTO location_members (location_id, user_id, role) VALUES ('loc1', 'u1', 'admin')").run();
  const id = `bin_${shortCode}_${Date.now()}_${Math.random()}`;
  db.prepare(
    "INSERT INTO bins (id, location_id, name, short_code, created_by) VALUES (?, 'loc1', 'Test', ?, 'u1')"
  ).run(id, shortCode);
}

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
  it('returns 6-char code when called without args', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(6);
  });

  it('returns PPP### format when name is provided', () => {
    const code = generateShortCode('Kitchen Supplies');
    expect(code).toMatch(/^[A-Z]{3}\d{3}$/);
    expect(code.slice(3)).toBe('001');
  });

  it('increments number for same prefix', () => {
    seedBin('KSP001');

    const code = generateShortCode('Kitchen Spare Parts');
    expect(code).toBe('KSP002');
  });

  it('uses provided prefix over derived one', () => {
    const code = generateShortCode('Kitchen Stuff', 'ABC');
    expect(code).toMatch(/^ABC\d{3}$/);
  });

  it('cleans prefix input — strips non-alpha and uppercases', () => {
    const code = generateShortCode('Test', 'a1bc');
    // 'a1bc' → strip digits → 'ABC' (first 3 alpha chars)
    expect(code).toMatch(/^ABC\d{3}$/);
  });

  it('falls back to name-derived prefix when cleaned prefix is too short', () => {
    const code = generateShortCode('Tools', 'a1');
    // 'a1' → strip digits → 'A' (only 1 char, too short)
    // Falls back to derivePrefix('Tools') → 'TLS'
    expect(code).toMatch(/^TLS\d{3}$/);
  });

  it('falls back to random code when no name and prefix is invalid', () => {
    const code = generateShortCode(undefined, '12');
    expect(code).toHaveLength(6);
  });

  it('falls back to random code when number exceeds 999', () => {
    seedBin('TST999');

    const code = generateShortCode('Test');
    expect(code).toHaveLength(6);
    // Should not start with TST followed by digits (would be 1000)
    expect(code).not.toMatch(/^TST\d/);
  });
});
