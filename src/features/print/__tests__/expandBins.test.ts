import { describe, expect, it } from 'vitest';
import type { Bin } from '@/types';
import { expandBinsByCopies } from '../expandBins';

function makeBin(id: string): Bin {
  return {
    id, short_code: id, location_id: 'loc1', name: `Bin ${id}`,
    area_id: null, area_name: '', items: [], notes: '', tags: [],
    icon: 'package', color: '', card_style: '', created_by: 'u1',
    created_by_name: 'User', visibility: 'location',
    custom_fields: {}, created_at: '2024-01-01', updated_at: '2024-01-01',
  };
}

describe('expandBinsByCopies', () => {
  const bins = [makeBin('a'), makeBin('b')];

  it('returns bins unchanged when copies is 1', () => {
    expect(expandBinsByCopies(bins, 1)).toBe(bins);
  });

  it('returns bins unchanged when copies is 0', () => {
    expect(expandBinsByCopies(bins, 0)).toBe(bins);
  });

  it('repeats each bin N times', () => {
    const result = expandBinsByCopies(bins, 3);
    expect(result).toHaveLength(6);
    expect(result.map((b) => b.id)).toEqual(['a', 'a', 'a', 'b', 'b', 'b']);
  });

  it('returns empty array for empty input', () => {
    expect(expandBinsByCopies([], 5)).toEqual([]);
  });
});
