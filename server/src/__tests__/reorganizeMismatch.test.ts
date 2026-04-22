import { describe, expect, it } from 'vitest';
import { detectReorganizeMismatchByIndex } from '../lib/reorganizeMismatch.js';

describe('detectReorganizeMismatchByIndex — force-single', () => {
  const opts = { allowDupes: false };

  it('matches when every input index appears exactly once', () => {
    expect(detectReorganizeMismatchByIndex(3, [1, 2, 3], opts)).toEqual({
      mismatch: false, dropped: [], invented: [],
    });
  });

  it('order-independent', () => {
    expect(detectReorganizeMismatchByIndex(3, [3, 1, 2], opts)).toEqual({
      mismatch: false, dropped: [], invented: [],
    });
  });

  it('flags missing indices as dropped', () => {
    const r = detectReorganizeMismatchByIndex(3, [1, 3], opts);
    expect(r.mismatch).toBe(true);
    expect(r.dropped).toEqual([2]);
    expect(r.invented).toEqual([]);
  });

  it('flags duplicate indices as invented', () => {
    const r = detectReorganizeMismatchByIndex(2, [1, 2, 2], opts);
    expect(r.mismatch).toBe(true);
    expect(r.dropped).toEqual([]);
    expect(r.invented).toEqual([2]);
  });

  it('flags out-of-range indices as invented', () => {
    const r = detectReorganizeMismatchByIndex(2, [1, 2, 99], opts);
    expect(r.mismatch).toBe(true);
    expect(r.invented).toEqual([99]);
  });

  it('flags zero and negative indices as invented', () => {
    const r = detectReorganizeMismatchByIndex(2, [0, 1, 2, -5], opts);
    expect(r.mismatch).toBe(true);
    expect(r.invented).toEqual(expect.arrayContaining([0, -5]));
    expect(r.invented).toHaveLength(2);
  });

  it('flags non-integer (fractional) indices as invented', () => {
    const r = detectReorganizeMismatchByIndex(2, [1, 1.5, 2], opts);
    expect(r.mismatch).toBe(true);
    expect(r.invented).toEqual([1.5]);
  });

  it('handles zero total items', () => {
    expect(detectReorganizeMismatchByIndex(0, [], opts)).toEqual({
      mismatch: false, dropped: [], invented: [],
    });
  });

  it('flags any output index when totalInputItems is zero', () => {
    const r = detectReorganizeMismatchByIndex(0, [1], opts);
    expect(r.mismatch).toBe(true);
    expect(r.invented).toEqual([1]);
  });
});

describe('detectReorganizeMismatchByIndex — allow duplicates', () => {
  const opts = { allowDupes: true };

  it('matches when output references all input indices (any multiplicity)', () => {
    expect(detectReorganizeMismatchByIndex(3, [1, 2, 3, 1, 3], opts)).toEqual({
      mismatch: false, dropped: [], invented: [],
    });
  });

  it('flags missing input indices as dropped (once each)', () => {
    const r = detectReorganizeMismatchByIndex(3, [1, 1, 1], opts);
    expect(r.mismatch).toBe(true);
    expect(r.dropped).toEqual(expect.arrayContaining([2, 3]));
    expect(r.dropped).toHaveLength(2);
    expect(r.invented).toEqual([]);
  });

  it('flags out-of-range as invented even under allowDupes', () => {
    const r = detectReorganizeMismatchByIndex(2, [1, 2, 99], opts);
    expect(r.mismatch).toBe(true);
    expect(r.invented).toEqual([99]);
  });

  it('duplicates do not count as invented under allowDupes', () => {
    const r = detectReorganizeMismatchByIndex(2, [1, 1, 2, 2], opts);
    expect(r.mismatch).toBe(false);
  });
});
