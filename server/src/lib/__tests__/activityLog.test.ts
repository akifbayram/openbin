import { describe, expect, it } from 'vitest';
import { mergeBinChanges } from '../activityLog.js';

describe('mergeBinChanges', () => {
  it('concatenates items_added arrays', () => {
    const existing = { items_added: { old: null, new: ['a', 'b'] } };
    const incoming = { items_added: { old: null, new: ['c'] } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      items_added: { old: null, new: ['a', 'b', 'c'] },
    });
  });

  it('concatenates items_removed arrays', () => {
    const existing = { items_removed: { old: ['a'], new: null } };
    const incoming = { items_removed: { old: ['b', 'c'], new: null } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      items_removed: { old: ['a', 'b', 'c'], new: null },
    });
  });

  it('merges scalar field chain preserving earliest old', () => {
    const existing = { notes: { old: 'A', new: 'B' } };
    const incoming = { notes: { old: 'B', new: 'C' } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      notes: { old: 'A', new: 'C' },
    });
  });

  it('merges tag arrays preserving earliest old', () => {
    const existing = { tags: { old: ['X'], new: ['X', 'Y'] } };
    const incoming = { tags: { old: ['X', 'Y'], new: ['Y'] } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      tags: { old: ['X'], new: ['Y'] },
    });
  });

  it('combines unrelated fields across merges', () => {
    const existing = { notes: { old: 'A', new: 'B' } };
    const incoming = { tags: { old: [], new: ['t'] } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      notes: { old: 'A', new: 'B' },
      tags: { old: [], new: ['t'] },
    });
  });

  it('first occurrence of a scalar field uses incoming.old', () => {
    const existing = {};
    const incoming = { color: { old: 'red', new: 'blue' } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      color: { old: 'red', new: 'blue' },
    });
  });

  it('preserves undefined old when merging chained updates (regression guard for hasOwnProperty check)', () => {
    const existing = { color: { old: undefined, new: 'blue' } };
    const incoming = { color: { old: 'blue', new: 'green' } };
    expect(mergeBinChanges(existing, incoming)).toEqual({
      color: { old: undefined, new: 'green' },
    });
  });
});
