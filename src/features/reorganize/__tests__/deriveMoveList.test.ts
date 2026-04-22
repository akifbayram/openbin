import { describe, expect, it } from 'vitest';
import type { Bin } from '@/types';
import { buildReorganizePlan, deriveMoveList } from '../deriveMoveList';
import type { PartialReorgResult } from '../parsePartialReorg';
import type { ReorgResponse } from '../useReorganize';

function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'b-default',
    short_code: 'AAA111',
    location_id: 'loc1',
    name: 'Default',
    area_id: null,
    area_name: '',
    items: [],
    notes: '',
    tags: [],
    icon: 'Package',
    color: '',
    card_style: '',
    created_by: 'u1',
    created_by_name: 'U',
    visibility: 'location',
    custom_fields: {},
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  };
}

const emptyResult: PartialReorgResult = { bins: [], summary: '' };

describe('deriveMoveList', () => {
  it('returns source cards with empty clusters when no result bins', () => {
    const input = [makeBin({ id: 'b1', name: 'A', items: [{ id: 'i1', name: 'Hammer', quantity: null }] })];
    const r = deriveMoveList(input, emptyResult);
    expect(r.sourceCards).toHaveLength(1);
    expect(r.sourceCards[0].outgoingClusters).toEqual([]);
    expect(r.sourceCards[0].preserved).toBe(false);
    expect(r.totalMoves).toBe(0);
    expect(r.totalDestinationBins).toBe(0);
    expect(r.totalItems).toBe(0);
  });

  it('marks a source preserved when its name matches a destination', () => {
    const input = [makeBin({
      id: 'b1',
      name: 'Hand Tools',
      items: [{ id: 'i1', name: 'Hammer', quantity: null }, { id: 'i2', name: 'Screw', quantity: 5 }],
    })];
    const result: PartialReorgResult = {
      bins: [{ name: 'Hand Tools', items: ['Hammer', 'Screw'], tags: [] }],
      summary: '',
    };
    const r = deriveMoveList(input, result);
    expect(r.sourceCards[0].preserved).toBe(true);
    expect(r.sourceCards[0].outgoingClusters[0].destinationKept).toBe(true);
  });

  it('marks a source not preserved when names do not match', () => {
    const input = [makeBin({
      id: 'b1',
      name: 'Garage',
      items: [{ id: 'i1', name: 'Hammer', quantity: null }],
    })];
    const result: PartialReorgResult = {
      bins: [{ name: 'Hand Tools', items: ['Hammer'], tags: [] }],
      summary: '',
    };
    const r = deriveMoveList(input, result);
    expect(r.sourceCards[0].preserved).toBe(false);
    expect(r.sourceCards[0].outgoingClusters[0].destinationKept).toBe(false);
  });

  it('marks destinationKept only for the cluster whose name matches, not other outgoing clusters', () => {
    const input = [makeBin({
      id: 'b1',
      name: 'Tools',
      items: [
        { id: 'i1', name: 'Hammer', quantity: null },
        { id: 'i2', name: 'Flashlight', quantity: null },
      ],
    })];
    const result: PartialReorgResult = {
      bins: [
        { name: 'Tools', items: ['Hammer'], tags: [] },
        { name: 'Electronics', items: ['Flashlight'], tags: [] },
      ],
      summary: '',
    };
    const r = deriveMoveList(input, result);
    expect(r.sourceCards[0].preserved).toBe(true);
    expect(r.sourceCards[0].outgoingClusters[0].destinationKept).toBe(true);
    expect(r.sourceCards[0].outgoingClusters[1].destinationKept).toBe(false);
  });

  it('preserves source card order from input', () => {
    const input = [
      makeBin({ id: 'b1', name: 'First', items: [{ id: 'i1', name: 'A', quantity: null }] }),
      makeBin({ id: 'b2', name: 'Second', items: [{ id: 'i2', name: 'B', quantity: null }] }),
    ];
    const result: PartialReorgResult = {
      bins: [{ name: 'Combined', items: ['B', 'A'], tags: [] }],
      summary: '',
    };
    const r = deriveMoveList(input, result);
    expect(r.sourceCards.map((s) => s.sourceBin.id)).toEqual(['b1', 'b2']);
  });

  it('preserves destination order from AI output', () => {
    const input = [makeBin({
      id: 'b1',
      name: 'Source',
      items: [
        { id: 'i1', name: 'Alpha', quantity: null },
        { id: 'i2', name: 'Beta', quantity: null },
        { id: 'i3', name: 'Gamma', quantity: null },
      ],
    })];
    const result: PartialReorgResult = {
      bins: [
        { name: 'Third', items: ['Gamma'], tags: [] },
        { name: 'First', items: ['Alpha'], tags: [] },
        { name: 'Second', items: ['Beta'], tags: [] },
      ],
      summary: '',
    };
    const r = deriveMoveList(input, result);
    expect(r.sourceCards[0].outgoingClusters.map((c) => c.destinationName)).toEqual(['Third', 'First', 'Second']);
  });

  it('normalization handles whitespace/case differences for destinationKept', () => {
    const input = [makeBin({
      id: 'b1',
      name: '  HAND  TOOLS ',
      items: [{ id: 'i1', name: 'Hammer', quantity: null }],
    })];
    const result: PartialReorgResult = {
      bins: [{ name: 'hand tools', items: ['Hammer'], tags: [] }],
      summary: '',
    };
    const r = deriveMoveList(input, result);
    expect(r.sourceCards[0].preserved).toBe(true);
    expect(r.sourceCards[0].outgoingClusters[0].destinationKept).toBe(true);
  });

  it('handles multi-destination under duplicates:allow', () => {
    const input = [makeBin({
      id: 'b1',
      name: 'Src',
      items: [{ id: 'i1', name: 'Batteries', quantity: null }],
    })];
    const result: PartialReorgResult = {
      bins: [
        { name: 'Electronics', items: ['Batteries'], tags: [] },
        { name: 'Misc Tools', items: ['Batteries'], tags: [] },
      ],
      summary: '',
    };
    const r = deriveMoveList(input, result);
    expect(r.sourceCards[0].outgoingClusters).toHaveLength(2);
    expect(r.sourceCards[0].outgoingClusters[0].items[0].multiDestinationCount).toBe(2);
    expect(r.sourceCards[0].outgoingClusters[1].items[0].multiDestinationCount).toBe(2);
  });

  it('merges sources when two source bins share an item name going to the same destination', () => {
    const input = [
      makeBin({ id: 'b1', name: 'Garage', items: [{ id: 'i1', name: 'Screw', quantity: 10 }] }),
      makeBin({ id: 'b2', name: 'Misc', items: [{ id: 'i2', name: 'Screw', quantity: 3 }] }),
    ];
    const result: PartialReorgResult = {
      bins: [{ name: 'Fasteners', items: ['Screw'], tags: [] }],
      summary: '',
    };
    const r = deriveMoveList(input, result);
    expect(r.sourceCards).toHaveLength(2);
    expect(r.sourceCards[0].outgoingClusters[0].destinationName).toBe('Fasteners');
    expect(r.sourceCards[1].outgoingClusters[0].destinationName).toBe('Fasteners');
  });

  it('counts totalItems and totalDestinationBins correctly', () => {
    const input = [
      makeBin({ id: 'b1', name: 'A', items: [{ id: 'i1', name: 'x', quantity: null }] }),
      makeBin({ id: 'b2', name: 'B', items: [{ id: 'i2', name: 'y', quantity: null }, { id: 'i3', name: 'z', quantity: null }] }),
    ];
    const result: PartialReorgResult = {
      bins: [
        { name: 'D1', items: ['x', 'y'], tags: [] },
        { name: 'D2', items: ['z'], tags: [] },
      ],
      summary: '',
    };
    const r = deriveMoveList(input, result);
    expect(r.totalItems).toBe(3);
    expect(r.totalDestinationBins).toBe(2);
    expect(r.totalMoves).toBe(3);
  });

  it('degrades gracefully when partial output is missing items', () => {
    const input = [makeBin({
      id: 'b1',
      name: 'Src',
      items: [{ id: 'i1', name: 'Alpha', quantity: null }, { id: 'i2', name: 'Beta', quantity: null }],
    })];
    const result: PartialReorgResult = {
      bins: [{ name: 'Dest', items: ['Alpha'], tags: [] }],
      summary: '',
    };
    expect(() => deriveMoveList(input, result)).not.toThrow();
    const r = deriveMoveList(input, result);
    expect(r.sourceCards[0].outgoingClusters[0].items.map((i) => i.name)).toEqual(['Alpha']);
  });

  it('skips output items whose names do not match any source (defensive)', () => {
    const input = [makeBin({
      id: 'b1',
      name: 'Src',
      items: [{ id: 'i1', name: 'Hammer', quantity: null }],
    })];
    const result: PartialReorgResult = {
      bins: [{ name: 'Dest', items: ['Hammer', 'Wrench'], tags: [] }],
      summary: '',
    };
    const r = deriveMoveList(input, result);
    expect(r.sourceCards[0].outgoingClusters[0].items.map((i) => i.name)).toEqual(['Hammer']);
  });
});

describe('buildReorganizePlan', () => {
  function asComplete(partial: PartialReorgResult): ReorgResponse {
    return { bins: partial.bins.map((b) => ({ name: b.name, items: b.items, tags: b.tags })), summary: partial.summary };
  }

  it('pure rename: one source name matches one dest — preserved, no deletions, no creations', () => {
    const input = [makeBin({ id: 'b1', name: 'Hand Tools', items: [{ id: 'i1', name: 'Hammer', quantity: null }] })];
    const result = asComplete({ bins: [{ name: 'Hand Tools', items: ['Hammer'], tags: [] }], summary: '' });
    const plan = buildReorganizePlan(input, result);
    expect(plan.preservations).toHaveLength(1);
    expect(plan.preservations[0].sourceBinId).toBe('b1');
    expect(plan.preservations[0].destBin.name).toBe('Hand Tools');
    expect(plan.deletions).toEqual([]);
    expect(plan.creations).toEqual([]);
  });

  it('no name match: full replace — no preservations, all sources deleted, all dests created', () => {
    const input = [makeBin({ id: 'b1', name: 'Garage', items: [{ id: 'i1', name: 'A', quantity: null }] })];
    const result = asComplete({ bins: [{ name: 'Tools', items: ['A'], tags: [] }], summary: '' });
    const plan = buildReorganizePlan(input, result);
    expect(plan.preservations).toEqual([]);
    expect(plan.deletions).toEqual(['b1']);
    expect(plan.creations).toHaveLength(1);
    expect(plan.creations[0].name).toBe('Tools');
  });

  it('split with matching name: source preserved, split-off dest created', () => {
    const input = [makeBin({
      id: 'b1',
      name: 'Tools',
      items: [
        { id: 'i1', name: 'Hammer', quantity: null },
        { id: 'i2', name: 'Battery', quantity: null },
      ],
    })];
    const result = asComplete({
      bins: [
        { name: 'Tools', items: ['Hammer'], tags: [] },
        { name: 'Misc', items: ['Battery'], tags: [] },
      ],
      summary: '',
    });
    const plan = buildReorganizePlan(input, result);
    expect(plan.preservations).toHaveLength(1);
    expect(plan.preservations[0].sourceBinId).toBe('b1');
    expect(plan.preservations[0].destBin.items).toEqual(['Hammer']);
    expect(plan.deletions).toEqual([]);
    expect(plan.creations).toHaveLength(1);
    expect(plan.creations[0].name).toBe('Misc');
  });

  it('merge into name-matched dest: one source preserved, other deleted', () => {
    const input = [
      makeBin({ id: 'b1', name: 'Hand Tools', items: [{ id: 'i1', name: 'Hammer', quantity: null }] }),
      makeBin({ id: 'b2', name: 'Garage Junk', items: [{ id: 'i2', name: 'Wrench', quantity: null }] }),
    ];
    const result = asComplete({
      bins: [{ name: 'Hand Tools', items: ['Hammer', 'Wrench'], tags: [] }],
      summary: '',
    });
    const plan = buildReorganizePlan(input, result);
    expect(plan.preservations).toHaveLength(1);
    expect(plan.preservations[0].sourceBinId).toBe('b1');
    expect(plan.deletions).toEqual(['b2']);
    expect(plan.creations).toEqual([]);
  });

  it('duplicate source names: highest item-overlap wins, loser deleted', () => {
    const input = [
      makeBin({ id: 'b1', name: 'Tools', items: [{ id: 'i1', name: 'Unrelated', quantity: null }] }),
      makeBin({ id: 'b2', name: 'Tools', items: [
        { id: 'i2', name: 'Hammer', quantity: null },
        { id: 'i3', name: 'Wrench', quantity: null },
      ] }),
    ];
    const result = asComplete({
      bins: [{ name: 'Tools', items: ['Hammer', 'Wrench'], tags: [] }],
      summary: '',
    });
    const plan = buildReorganizePlan(input, result);
    expect(plan.preservations).toHaveLength(1);
    expect(plan.preservations[0].sourceBinId).toBe('b2');
    expect(plan.deletions).toEqual(['b1']);
  });

  it('duplicate source names with identical overlap: first selection order wins', () => {
    const input = [
      makeBin({ id: 'b1', name: 'Tools', items: [{ id: 'i1', name: 'Hammer', quantity: null }] }),
      makeBin({ id: 'b2', name: 'Tools', items: [{ id: 'i2', name: 'Hammer', quantity: null }] }),
    ];
    const result = asComplete({
      bins: [{ name: 'Tools', items: ['Hammer'], tags: [] }],
      summary: '',
    });
    const plan = buildReorganizePlan(input, result);
    expect(plan.preservations).toHaveLength(1);
    expect(plan.preservations[0].sourceBinId).toBe('b1');
    expect(plan.deletions).toEqual(['b2']);
  });

  it('name normalization matches across whitespace and case', () => {
    const input = [makeBin({
      id: 'b1',
      name: '  HAND  TOOLS ',
      items: [{ id: 'i1', name: 'Hammer', quantity: null }],
    })];
    const result = asComplete({ bins: [{ name: 'hand tools', items: ['Hammer'], tags: [] }], summary: '' });
    const plan = buildReorganizePlan(input, result);
    expect(plan.preservations).toHaveLength(1);
    expect(plan.preservations[0].sourceBinId).toBe('b1');
    expect(plan.deletions).toEqual([]);
    expect(plan.creations).toEqual([]);
  });

  it('empty AI result: all sources deleted, no creations', () => {
    const input = [
      makeBin({ id: 'b1', name: 'A', items: [{ id: 'i1', name: 'x', quantity: null }] }),
      makeBin({ id: 'b2', name: 'B', items: [{ id: 'i2', name: 'y', quantity: null }] }),
    ];
    const result = asComplete({ bins: [], summary: '' });
    const plan = buildReorganizePlan(input, result);
    expect(plan.preservations).toEqual([]);
    expect(plan.deletions).toEqual(['b1', 'b2']);
    expect(plan.creations).toEqual([]);
  });

  it('empty input bins: plan is entirely creations', () => {
    const result = asComplete({ bins: [{ name: 'Anything', items: ['x'], tags: [] }], summary: '' });
    const plan = buildReorganizePlan([], result);
    expect(plan.preservations).toEqual([]);
    expect(plan.deletions).toEqual([]);
    expect(plan.creations).toHaveLength(1);
  });
});
