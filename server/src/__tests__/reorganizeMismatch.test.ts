import { describe, expect, it } from 'vitest';
import { detectReorganizeMismatch, normalizeItemName } from '../lib/reorganizeMismatch.js';

describe('normalizeItemName', () => {
  it('trims, lowercases, collapses whitespace', () => {
    expect(normalizeItemName('  Hammer  ')).toBe('hammer');
    expect(normalizeItemName('USB  Cable')).toBe('usb cable');
    expect(normalizeItemName('Tape\tMeasure')).toBe('tape measure');
  });
});

describe('detectReorganizeMismatch — force-single', () => {
  const opts = { allowDupes: false };

  it('matches when multisets are equal', () => {
    const r = detectReorganizeMismatch(['hammer', 'screw', 'screw'], ['screw', 'hammer', 'screw'], opts);
    expect(r).toEqual({ mismatch: false, dropped: [], invented: [] });
  });

  it('flags dropped items', () => {
    const r = detectReorganizeMismatch(['hammer', 'screw'], ['hammer'], opts);
    expect(r.mismatch).toBe(true);
    expect(r.dropped).toEqual(['screw']);
    expect(r.invented).toEqual([]);
  });

  it('flags invented items', () => {
    const r = detectReorganizeMismatch(['hammer'], ['hammer', 'wrench'], opts);
    expect(r.mismatch).toBe(true);
    expect(r.dropped).toEqual([]);
    expect(r.invented).toEqual(['wrench']);
  });

  it('flags count mismatch for repeated names', () => {
    const r = detectReorganizeMismatch(['screw', 'screw'], ['screw'], opts);
    expect(r.mismatch).toBe(true);
    expect(r.dropped).toEqual(['screw']);
  });

  it('flags invented for a name over-represented in output', () => {
    const r = detectReorganizeMismatch(['screw'], ['screw', 'screw'], opts);
    expect(r.mismatch).toBe(true);
    expect(r.dropped).toEqual([]);
    expect(r.invented).toEqual(['screw']);
  });

  it('normalizes case and whitespace when comparing', () => {
    const r = detectReorganizeMismatch(['Hammer', '  screw '], ['HAMMER', 'screw'], opts);
    expect(r.mismatch).toBe(false);
  });

  it('returns empty result for both sides empty', () => {
    expect(detectReorganizeMismatch([], [], opts)).toEqual({ mismatch: false, dropped: [], invented: [] });
  });
});

describe('detectReorganizeMismatch — duplicates allowed', () => {
  const opts = { allowDupes: true };

  it('allows output count greater than input count', () => {
    const r = detectReorganizeMismatch(['batteries'], ['batteries', 'batteries'], opts);
    expect(r.mismatch).toBe(false);
  });

  it('flags dropped names even when dupes are allowed', () => {
    const r = detectReorganizeMismatch(['batteries', 'bulbs'], ['batteries', 'batteries'], opts);
    expect(r.mismatch).toBe(true);
    expect(r.dropped).toEqual(['bulbs']);
    expect(r.invented).toEqual([]);
  });

  it('flags invented names when they are not in input', () => {
    const r = detectReorganizeMismatch(['batteries'], ['batteries', 'fuses'], opts);
    expect(r.mismatch).toBe(true);
    expect(r.invented).toEqual(['fuses']);
  });
});
