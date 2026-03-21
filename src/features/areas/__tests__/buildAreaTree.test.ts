import { describe, expect, it } from 'vitest';
import type { Area } from '@/types';
import { buildAreaTree, flattenAreaTree, getAreaPath } from '../useAreas';

function makeArea(id: string, name: string, parentId: string | null = null): Area {
  return {
    id,
    location_id: 'loc-1',
    name,
    parent_id: parentId,
    bin_count: 0,
    descendant_bin_count: 0,
    created_by: null,
    created_at: '',
    updated_at: '',
  };
}

describe('buildAreaTree', () => {
  it('returns empty array for no areas', () => {
    expect(buildAreaTree([])).toEqual([]);
  });

  it('returns all root areas at depth 0', () => {
    const areas = [makeArea('a', 'Garage'), makeArea('b', 'Kitchen')];
    const tree = buildAreaTree(areas);
    expect(tree).toHaveLength(2);
    expect(tree[0].depth).toBe(0);
    expect(tree[1].depth).toBe(0);
    expect(tree[0].children).toHaveLength(0);
  });

  it('nests children under parents', () => {
    const areas = [
      makeArea('a', 'Garage'),
      makeArea('b', 'Shelf 1', 'a'),
      makeArea('c', 'Shelf 2', 'a'),
    ];
    const tree = buildAreaTree(areas);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Garage');
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].depth).toBe(1);
    expect(tree[0].children[1].depth).toBe(1);
  });

  it('handles deep nesting', () => {
    const areas = [
      makeArea('a', 'Root'),
      makeArea('b', 'Level 1', 'a'),
      makeArea('c', 'Level 2', 'b'),
    ];
    const tree = buildAreaTree(areas);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].name).toBe('Level 2');
    expect(tree[0].children[0].children[0].depth).toBe(2);
  });

  it('treats areas with missing parent as roots', () => {
    const areas = [makeArea('a', 'Orphan', 'nonexistent')];
    const tree = buildAreaTree(areas);
    expect(tree).toHaveLength(1);
    expect(tree[0].depth).toBe(0);
  });
});

describe('flattenAreaTree', () => {
  it('returns depth-first order', () => {
    const areas = [
      makeArea('a', 'Garage'),
      makeArea('b', 'Shelf 1', 'a'),
      makeArea('c', 'Shelf 2', 'a'),
      makeArea('d', 'Kitchen'),
    ];
    const tree = buildAreaTree(areas);
    const flat = flattenAreaTree(tree);
    expect(flat.map((n) => n.name)).toEqual(['Garage', 'Shelf 1', 'Shelf 2', 'Kitchen']);
    expect(flat.map((n) => n.depth)).toEqual([0, 1, 1, 0]);
  });
});

describe('getAreaPath', () => {
  it('returns name for root area', () => {
    const areas = [makeArea('a', 'Garage')];
    expect(getAreaPath('a', areas)).toBe('Garage');
  });

  it('returns full path for nested area', () => {
    const areas = [
      makeArea('a', 'Garage'),
      makeArea('b', 'Shelf 1', 'a'),
    ];
    expect(getAreaPath('b', areas)).toBe('Garage / Shelf 1');
  });

  it('returns deep path', () => {
    const areas = [
      makeArea('a', 'Building'),
      makeArea('b', 'Floor 2', 'a'),
      makeArea('c', 'Room 3', 'b'),
    ];
    expect(getAreaPath('c', areas)).toBe('Building / Floor 2 / Room 3');
  });

  it('returns empty string for unknown area', () => {
    expect(getAreaPath('nonexistent', [])).toBe('');
  });
});
