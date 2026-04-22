import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useBulkSelection } from './useBulkSelection';

interface Item { id: string; name: string; }
const items: Item[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
  { id: 'd', name: 'Delta' },
];

describe('useBulkSelection', () => {
  it('starts with empty selection and selectable=false', () => {
    const { result } = renderHook(() => useBulkSelection<Item>({ items, resetDeps: [] }));
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.selectable).toBe(false);
  });

  it('toggleSelect adds and removes ids', () => {
    const { result } = renderHook(() => useBulkSelection<Item>({ items, resetDeps: [] }));
    act(() => result.current.toggleSelect('a', 0, false));
    expect([...result.current.selectedIds]).toEqual(['a']);
    expect(result.current.selectable).toBe(true);
    act(() => result.current.toggleSelect('a', 0, false));
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('shift-click selects a range from last selected index', () => {
    const { result } = renderHook(() => useBulkSelection<Item>({ items, resetDeps: [] }));
    act(() => result.current.toggleSelect('a', 0, false));
    act(() => result.current.toggleSelect('c', 2, true));
    expect([...result.current.selectedIds].sort()).toEqual(['a', 'b', 'c']);
  });

  it('Ctrl/Cmd+A selects all visible items', () => {
    const { result } = renderHook(() => useBulkSelection<Item>({ items, resetDeps: [] }));
    act(() => {
      const e = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
      document.dispatchEvent(e);
    });
    expect(result.current.selectedIds.size).toBe(4);
  });

  it('Escape clears selection', () => {
    const { result } = renderHook(() => useBulkSelection<Item>({ items, resetDeps: [] }));
    act(() => result.current.toggleSelect('a', 0, false));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('clearSelection empties the set', () => {
    const { result } = renderHook(() => useBulkSelection<Item>({ items, resetDeps: [] }));
    act(() => result.current.toggleSelect('a', 0, false));
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('resets selection when resetDeps change', () => {
    const { result, rerender } = renderHook(
      ({ dep }) => useBulkSelection<Item>({ items, resetDeps: [dep] }),
      { initialProps: { dep: 'a' } },
    );
    act(() => result.current.toggleSelect('a', 0, false));
    expect(result.current.selectedIds.size).toBe(1);
    rerender({ dep: 'b' });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('uses custom getId for non-id-shaped items', () => {
    interface Tag { tag: string; count: number; }
    const tags: Tag[] = [{ tag: 'x', count: 1 }, { tag: 'y', count: 2 }];
    const { result } = renderHook(() =>
      useBulkSelection<Tag>({ items: tags, getId: (t) => t.tag, resetDeps: [] }),
    );
    act(() => result.current.toggleSelect('x', 0, false));
    expect([...result.current.selectedIds]).toEqual(['x']);
  });

  it('shift-click anchor is captured before state update (regression)', () => {
    // The previous implementation read lastSelectedIndex.current inside the
    // setSelectedIds updater. React 18 defers the updater, so by the time it
    // ran the ref had already been mutated to the new index, collapsing the
    // range to a single item. This test exercises that path.
    const { result } = renderHook(() => useBulkSelection<Item>({ items, resetDeps: [] }));
    act(() => {
      // Two rapid sequential calls inside one act() — React batches these.
      result.current.toggleSelect('a', 0, false);
      result.current.toggleSelect('d', 3, true);
    });
    // Range from index 0 to index 3 → all four items selected.
    expect([...result.current.selectedIds].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores Ctrl+A when an input is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const { result } = renderHook(() => useBulkSelection<Item>({ items, resetDeps: [] }));
    act(() => {
      const e = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true });
      Object.defineProperty(e, 'target', { value: input });
      document.dispatchEvent(e);
    });
    expect(result.current.selectedIds.size).toBe(0);
    document.body.removeChild(input);
  });
});
