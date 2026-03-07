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
    expect(result.bins[0]).toEqual({ name: 'Tools', items: ['hammer', 'wrench'] });
    expect(result.bins[1]).toEqual({ name: 'Parts', items: ['screw'] });
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
});
