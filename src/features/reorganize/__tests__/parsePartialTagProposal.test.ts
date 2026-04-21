import { describe, expect, it } from 'vitest';
import { parsePartialTagProposal } from '../parsePartialTagProposal';

describe('parsePartialTagProposal', () => {
  it('returns empty result for empty string', () => {
    expect(parsePartialTagProposal('')).toEqual({
      taxonomy: { newTags: [], renames: [], merges: [], parents: [] },
      assignments: [],
      summary: '',
    });
  });

  it('extracts summary when present', () => {
    const text = '{"taxonomy":{"newTags":[]},"assignments":[],"summary":"Done."}';
    expect(parsePartialTagProposal(text).summary).toBe('Done.');
  });

  it('extracts complete newTags', () => {
    const text = '{"taxonomy":{"newTags":[{"tag":"fasteners","parent":"hardware"},{"tag":"cables"}]';
    const result = parsePartialTagProposal(text);
    expect(result.taxonomy.newTags).toEqual([
      { tag: 'fasteners', parent: 'hardware' },
      { tag: 'cables' },
    ]);
  });

  it('extracts renames', () => {
    const text = '{"taxonomy":{"newTags":[],"renames":[{"from":"tool","to":"tools"}]';
    expect(parsePartialTagProposal(text).taxonomy.renames).toEqual([{ from: 'tool', to: 'tools' }]);
  });

  it('extracts merges', () => {
    const text = '{"taxonomy":{"newTags":[],"renames":[],"merges":[{"from":["screw","screws"],"to":"fasteners"}]';
    expect(parsePartialTagProposal(text).taxonomy.merges).toEqual([
      { from: ['screw', 'screws'], to: 'fasteners' },
    ]);
  });

  it('extracts parents', () => {
    const text = '{"taxonomy":{"newTags":[],"renames":[],"merges":[],"parents":[{"tag":"hand-tools","parent":"tools"}]';
    expect(parsePartialTagProposal(text).taxonomy.parents).toEqual([
      { tag: 'hand-tools', parent: 'tools' },
    ]);
  });

  it('extracts assignments with complete add/remove arrays', () => {
    const text = '{"taxonomy":{"newTags":[],"renames":[],"merges":[],"parents":[]},"assignments":[{"binId":"abc-123","add":["tools","cables"],"remove":[]}]';
    expect(parsePartialTagProposal(text).assignments).toEqual([
      { binId: 'abc-123', add: ['tools', 'cables'], remove: [] },
    ]);
  });

  it('tolerates trailing partial tag in assignments', () => {
    const text = '{"taxonomy":{"newTags":[],"renames":[],"merges":[],"parents":[]},"assignments":[{"binId":"abc","add":["tools","fas';
    const result = parsePartialTagProposal(text);
    expect(result.assignments).toEqual([{ binId: 'abc', add: ['tools'], remove: [] }]);
  });

  it('handles hyphenated tags', () => {
    const text = '{"taxonomy":{"newTags":[{"tag":"hand-tools"}]';
    expect(parsePartialTagProposal(text).taxonomy.newTags).toEqual([{ tag: 'hand-tools' }]);
  });
});
