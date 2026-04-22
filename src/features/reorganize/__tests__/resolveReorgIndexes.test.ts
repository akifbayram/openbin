import { describe, expect, it } from 'vitest';
import type { Bin } from '@/types';
import { resolveReorgIndexes } from '../resolveReorgIndexes';

function makeBin(name: string, itemNames: string[]): Bin {
  return {
    id: `bin-${name}`,
    short_code: 'abc',
    location_id: 'loc',
    name,
    area_id: null,
    area_name: '',
    items: itemNames.map((n, i) => ({ id: `${name}-${i}`, name: n, quantity: null })),
    notes: '',
    tags: [],
    icon: '',
    color: '',
    card_style: '',
    created_by: 'u',
    created_by_name: 'u',
    visibility: 'location',
    custom_fields: {},
    created_at: '',
    updated_at: '',
  };
}

describe('resolveReorgIndexes', () => {
  const inputBins: Bin[] = [
    makeBin('Garage A', ['Hammer', 'Nails']),      // indices 1, 2
    makeBin('Garage B', ['Drill', 'Bits', 'Screws']), // indices 3, 4, 5
  ];

  it('converts itemIndices to string names in input order', () => {
    const result = resolveReorgIndexes(
      {
        bins: [
          { name: 'Tools', itemIndices: [1, 3], tags: ['hardware'] },
          { name: 'Fasteners', itemIndices: [2, 5], tags: [] },
        ],
      },
      inputBins,
    );
    expect(result).toEqual({
      bins: [
        { name: 'Tools', items: ['Hammer', 'Drill'], tags: ['hardware'] },
        { name: 'Fasteners', items: ['Nails', 'Screws'], tags: [] },
      ],
    });
  });

  it('global indexing crosses bin boundaries', () => {
    const result = resolveReorgIndexes(
      { bins: [{ name: 'All', itemIndices: [1, 2, 3, 4, 5], tags: [] }] },
      inputBins,
    );
    expect(result.bins[0].items).toEqual(['Hammer', 'Nails', 'Drill', 'Bits', 'Screws']);
  });

  it('drops out-of-range indices silently', () => {
    const result = resolveReorgIndexes(
      { bins: [{ name: 'X', itemIndices: [1, 99, 3], tags: [] }] },
      inputBins,
    );
    expect(result.bins[0].items).toEqual(['Hammer', 'Drill']);
  });

  it('drops zero and negative indices silently', () => {
    const result = resolveReorgIndexes(
      { bins: [{ name: 'X', itemIndices: [0, -1, 1], tags: [] }] },
      inputBins,
    );
    expect(result.bins[0].items).toEqual(['Hammer']);
  });

  it('keeps duplicate indices (rendering preserves them; validation handles correctness)', () => {
    const result = resolveReorgIndexes(
      { bins: [{ name: 'X', itemIndices: [1, 1, 2], tags: [] }] },
      inputBins,
    );
    expect(result.bins[0].items).toEqual(['Hammer', 'Hammer', 'Nails']);
  });

  it('handles empty input bins (no items)', () => {
    const result = resolveReorgIndexes(
      { bins: [{ name: 'X', itemIndices: [1], tags: [] }] },
      [],
    );
    expect(result.bins[0].items).toEqual([]);
  });

  it('returns empty bins array for empty input', () => {
    const result = resolveReorgIndexes({ bins: [] }, inputBins);
    expect(result).toEqual({ bins: [] });
  });
});
