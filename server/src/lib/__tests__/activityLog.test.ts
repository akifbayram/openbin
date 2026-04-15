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
});
