import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { QueryMatch } from '../useInventoryQuery';
import { useItemQuerySelection } from '../useItemQuerySelection';

const matches: QueryMatch[] = [
  {
    bin_id: 'b1', name: 'A', area_name: '', tags: [], relevance: '',
    items: [{ id: 'i1', name: '1', quantity: null }, { id: 'i2', name: '2', quantity: null }],
    icon: '', color: '',
  },
  {
    bin_id: 'b2', name: 'B', area_name: '', tags: [], relevance: '',
    items: [{ id: 'i3', name: '3', quantity: null }],
    icon: '', color: '',
  },
];

describe('useItemQuerySelection', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useItemQuerySelection(matches));
    expect(result.current.selectionCount).toBe(0);
  });

  it('toggleItem adds and removes', () => {
    const { result } = renderHook(() => useItemQuerySelection(matches));
    act(() => result.current.toggleItem('i1', 'b1', '1'));
    expect(result.current.selectionCount).toBe(1);
    expect(result.current.isSelected('i1')).toBe(true);
    act(() => result.current.toggleItem('i1', 'b1', '1'));
    expect(result.current.selectionCount).toBe(0);
  });

  it('selectAllInBin selects every item in that bin', () => {
    const { result } = renderHook(() => useItemQuerySelection(matches));
    act(() => result.current.selectAllInBin('b1'));
    expect(result.current.selectionCount).toBe(2);
    expect(result.current.isBinFullySelected('b1')).toBe(true);
    expect(result.current.isBinFullySelected('b2')).toBe(false);
  });

  it('clearSelection empties the set', () => {
    const { result } = renderHook(() => useItemQuerySelection(matches));
    act(() => result.current.selectAllInBin('b1'));
    act(() => result.current.clearSelection());
    expect(result.current.selectionCount).toBe(0);
  });

  it('isAnySelectedInBin returns true when any item in the bin is selected', () => {
    const { result } = renderHook(() => useItemQuerySelection(matches));
    act(() => result.current.toggleItem('i1', 'b1', '1'));
    expect(result.current.isAnySelectedInBin('b1')).toBe(true);
    expect(result.current.isAnySelectedInBin('b2')).toBe(false);
  });
});
