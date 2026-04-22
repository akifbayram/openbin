import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db.js', () => ({
  d: {
    now: () => "datetime('now')",
    nocase: () => 'COLLATE NOCASE',
    jsonEachFrom: (col: string, alias: string) => `json_each(${col}) ${alias}`,
    jsonGroupArray: (e: string) => `json_group_array(${e})`,
  },
  generateUuid: () => 'uuid-fixed',
}));

import { applyTagMutations, detectParentCycle } from '../tagMutations.js';

describe('detectParentCycle', () => {
  it('returns null for an acyclic plan', () => {
    expect(detectParentCycle([
      { tag: 'a', parent: 'b' },
      { tag: 'b', parent: null },
    ])).toBeNull();
  });
  it('returns the offending tag for a 2-cycle', () => {
    expect(detectParentCycle([
      { tag: 'a', parent: 'b' },
      { tag: 'b', parent: 'a' },
    ])).toBe('a');
  });
  it('returns the offending tag for a 3-cycle', () => {
    expect(detectParentCycle([
      { tag: 'a', parent: 'b' },
      { tag: 'b', parent: 'c' },
      { tag: 'c', parent: 'a' },
    ])).toBe('a');
  });
});

describe('applyTagMutations', () => {
  let txQuery: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    txQuery = vi.fn().mockResolvedValue({ rows: [] });
  });

  it('renames a tag across bins and tag_colors', async () => {
    txQuery.mockResolvedValueOnce({ rows: [{ updated: 1 }, { updated: 1 }] }); // bins update
    txQuery.mockResolvedValueOnce({ rows: [] }); // child reassign
    txQuery.mockResolvedValueOnce({ rows: [] }); // tag_colors rename
    const counts = await applyTagMutations(txQuery as any, 'loc-1', { renames: [{ from: 'old', to: 'new' }] });
    expect(counts.tagsRenamed).toBe(1);
  });

  it('deletes a tag and orphans its children', async () => {
    txQuery.mockResolvedValueOnce({ rows: [{ updated: 1 }] }); // bins update
    txQuery.mockResolvedValueOnce({ rows: [{ tag: 'child-1' }] }); // orphan children
    txQuery.mockResolvedValueOnce({ rows: [] }); // delete tag_colors
    const counts = await applyTagMutations(txQuery as any, 'loc-1', { deletes: ['gone'] });
    expect(counts.tagsDeleted).toBe(1);
    expect(counts.orphanedChildren).toBe(1);
  });

  it('merges N→1 with cycle prevention', async () => {
    txQuery.mockResolvedValue({ rows: [] });
    const counts = await applyTagMutations(txQuery as any, 'loc-1', {
      merges: [{ from: ['a', 'b'], to: 'unified' }],
    });
    expect(counts.tagsMerged).toBe(1);
  });
});
