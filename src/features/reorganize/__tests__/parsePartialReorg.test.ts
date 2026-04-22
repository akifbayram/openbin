import { describe, expect, it } from 'vitest';
import { parsePartialReorg } from '../parsePartialReorg';

describe('parsePartialReorg', () => {
  it('returns empty result for empty string', () => {
    expect(parsePartialReorg('')).toEqual({ bins: [], summary: '' });
  });

  it('extracts bins with items from partial JSON', () => {
    const text = '{"bins": [{"name": "Tools", "items": ["hammer", "wrench"]}, {"name": "Parts", "items": ["screw';
    const result = parsePartialReorg(text);
    expect(result.bins).toHaveLength(2);
    expect(result.bins[0]).toEqual({ name: 'Tools', items: ['hammer', 'wrench'], tags: [] });
    expect(result.bins[1]).toEqual({ name: 'Parts', items: ['screw'], tags: [] });
  });

  it('extracts summary when complete', () => {
    const text = '{"bins": [{"name": "A", "items": ["x"]}], "summary": "Done."}';
    const result = parsePartialReorg(text);
    expect(result.summary).toBe('Done.');
  });

  it('handles empty bins array', () => {
    const text = '{"bins": []';
    expect(parsePartialReorg(text)).toEqual({ bins: [], summary: '' });
  });

  it('extracts tags from completed bins', () => {
    const text = '{"bins":[{"name":"Tools","items":["Hammer","Wrench"],"tags":["tools","hardware"]},{"name":"Cables","items":["USB-C"],"tags":["electronics","cables"]}],"summary":"Split by category"}';
    const result = parsePartialReorg(text);
    expect(result.bins).toEqual([
      { name: 'Tools', items: ['Hammer', 'Wrench'], tags: ['tools', 'hardware'] },
      { name: 'Cables', items: ['USB-C'], tags: ['electronics', 'cables'] },
    ]);
  });

  it('handles bins with empty tags array', () => {
    const text = '{"bins":[{"name":"Misc","items":["Tape"],"tags":[]}],"summary":"One bin"}';
    const result = parsePartialReorg(text);
    expect(result.bins[0].tags).toEqual([]);
  });

  it('handles bins without tags field', () => {
    const text = '{"bins":[{"name":"Misc","items":["Tape"]}],"summary":"One bin"}';
    const result = parsePartialReorg(text);
    expect(result.bins[0].tags).toEqual([]);
  });

  it('does not bleed tags from a later bin into an earlier bin without tags', () => {
    const text = '{"bins":[{"name":"A","items":["x"]},{"name":"B","items":["y"],"tags":["foo"]}],"summary":"test"}';
    const result = parsePartialReorg(text);
    expect(result.bins[0].tags).toEqual([]);
    expect(result.bins[1].tags).toEqual(['foo']);
  });
});
