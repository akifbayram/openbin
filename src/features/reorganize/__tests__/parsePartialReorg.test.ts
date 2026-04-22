import { describe, expect, it } from 'vitest';
import { parsePartialReorg } from '../parsePartialReorg';

describe('parsePartialReorg', () => {
  it('returns empty result for empty string', () => {
    expect(parsePartialReorg('')).toEqual({ bins: [] });
  });

  it('extracts bins with integer items from partial JSON', () => {
    const text = '{"bins": [{"name": "Tools", "items": [1, 3]}, {"name": "Parts", "items": [2';
    const result = parsePartialReorg(text);
    expect(result.bins).toHaveLength(2);
    expect(result.bins[0]).toEqual({ name: 'Tools', itemIndices: [1, 3], tags: [] });
    // Index 2 is not yet followed by a delimiter — parser holds it back.
    expect(result.bins[1]).toEqual({ name: 'Parts', itemIndices: [], tags: [] });
  });

  it('emits integer only when followed by a delimiter', () => {
    // "12" followed by nothing — unclear whether it's complete or a prefix of "123".
    expect(parsePartialReorg('{"bins":[{"name":"A","items":[12').bins[0].itemIndices).toEqual([]);
    // "12," — the comma confirms "12" is complete.
    expect(parsePartialReorg('{"bins":[{"name":"A","items":[12,').bins[0].itemIndices).toEqual([12]);
    // "12]" — bracket confirms "12" is complete.
    expect(parsePartialReorg('{"bins":[{"name":"A","items":[12]').bins[0].itemIndices).toEqual([12]);
  });

  it('holds back only the trailing partial integer when array is unclosed', () => {
    const text = '{"bins":[{"name":"A","items":[1,2,3';
    const result = parsePartialReorg(text);
    expect(result.bins[0].itemIndices).toEqual([1, 2]); // 3 is held back (no delimiter)
  });

  it('handles empty bins array', () => {
    const text = '{"bins": []';
    expect(parsePartialReorg(text)).toEqual({ bins: [] });
  });

  it('extracts tags from completed bins', () => {
    const text = '{"bins":[{"name":"Tools","items":[1,2],"tags":["tools","hardware"]},{"name":"Cables","items":[3],"tags":["electronics"]}]}';
    const result = parsePartialReorg(text);
    expect(result.bins).toEqual([
      { name: 'Tools', itemIndices: [1, 2], tags: ['tools', 'hardware'] },
      { name: 'Cables', itemIndices: [3], tags: ['electronics'] },
    ]);
  });

  it('handles bins with empty tags array', () => {
    const text = '{"bins":[{"name":"Misc","items":[1],"tags":[]}]}';
    const result = parsePartialReorg(text);
    expect(result.bins[0].tags).toEqual([]);
  });

  it('handles empty items array', () => {
    const text = '{"bins":[{"name":"Empty","items":[],"tags":[]}]}';
    const result = parsePartialReorg(text);
    expect(result.bins[0].itemIndices).toEqual([]);
  });

  it('ignores non-numeric tokens inside items array (robustness against model fallbacks)', () => {
    const text = '{"bins":[{"name":"A","items":[1,"hammer",2]}]}';
    const result = parsePartialReorg(text);
    expect(result.bins[0].itemIndices).toEqual([1, 2]);
  });

  it('handles multi-digit indices', () => {
    const text = '{"bins":[{"name":"A","items":[10,99,200]}]}';
    const result = parsePartialReorg(text);
    expect(result.bins[0].itemIndices).toEqual([10, 99, 200]);
  });
});
