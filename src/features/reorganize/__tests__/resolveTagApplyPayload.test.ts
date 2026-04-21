import { describe, expect, it } from 'vitest';
import { resolveTagApplyPayload } from '../resolveTagApplyPayload';
import type { TagProposalResult, TagUserSelections } from '../useReorganizeTags';

const fullResult: TagProposalResult = {
  taxonomy: {
    newTags: [{ tag: 'fasteners' }, { tag: 'cables' }],
    renames: [{ from: 'tool', to: 'tools' }],
    merges: [{ from: ['screw', 'screws'], to: 'fasteners' }],
    parents: [{ tag: 'hand-tools', parent: 'tools' }],
  },
  assignments: [
    { binId: 'bin-1', add: ['tools', 'fasteners'], remove: [] },
    { binId: 'bin-2', add: ['cables'], remove: ['old'] },
  ],
  summary: 'ok',
};

function allChecked(): TagUserSelections {
  return {
    newTags: new Set(['fasteners', 'cables']),
    renames: new Set(['tool->tools']),
    merges: new Set(['fasteners']),
    parents: new Set(['hand-tools->tools']),
    assignments: new Set(['bin-1', 'bin-2']),
  };
}

describe('resolveTagApplyPayload', () => {
  it('passes through all changes when everything is checked', () => {
    const payload = resolveTagApplyPayload(fullResult, allChecked());
    expect(payload.taxonomy.newTags).toHaveLength(2);
    expect(payload.taxonomy.renames).toHaveLength(1);
    expect(payload.taxonomy.merges).toHaveLength(1);
    expect(payload.taxonomy.parents).toHaveLength(1);
    expect(Object.keys(payload.assignments.add)).toEqual(['bin-1', 'bin-2']);
  });

  it('drops unchecked newTag from taxonomy and add arrays', () => {
    const sel = allChecked();
    sel.newTags.delete('cables');
    const payload = resolveTagApplyPayload(fullResult, sel);
    expect(payload.taxonomy.newTags.map((t) => t.tag)).toEqual(['fasteners']);
    expect(payload.assignments.add['bin-2']).toBeUndefined();
  });

  it('drops unchecked rename and removes target from add arrays', () => {
    const sel = allChecked();
    sel.renames.delete('tool->tools');
    const payload = resolveTagApplyPayload(fullResult, sel);
    expect(payload.taxonomy.renames).toEqual([]);
    expect(payload.assignments.add['bin-1']).toEqual(['fasteners']);
  });

  it('drops unchecked parent entry', () => {
    const sel = allChecked();
    sel.parents.delete('hand-tools->tools');
    const payload = resolveTagApplyPayload(fullResult, sel);
    expect(payload.taxonomy.parents).toEqual([]);
  });

  it('drops unchecked per-bin assignment', () => {
    const sel = allChecked();
    sel.assignments.delete('bin-1');
    const payload = resolveTagApplyPayload(fullResult, sel);
    expect(payload.assignments.add['bin-1']).toBeUndefined();
  });

  it('keeps remove entry even when add becomes empty', () => {
    const sel = allChecked();
    sel.newTags.delete('cables');
    const payload = resolveTagApplyPayload(fullResult, sel);
    expect(payload.assignments.remove['bin-2']).toEqual(['old']);
  });
});
