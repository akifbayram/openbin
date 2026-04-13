import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useItemPagination } from '../useItemPagination';

function makeItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `${i + 1}`, name: `Item ${i + 1}` }));
}

describe('useItemPagination', () => {
  it('handles an empty list', () => {
    const { result } = renderHook(() => useItemPagination([], 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.rangeStart).toBe(0);
    expect(result.current.rangeEnd).toBe(0);
  });

  it('shows full list when count fits on one page', () => {
    const { result } = renderHook(() => useItemPagination(makeItems(5), 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.visibleItems).toHaveLength(5);
    expect(result.current.rangeStart).toBe(1);
    expect(result.current.rangeEnd).toBe(5);
  });

  it('paginates a list across multiple pages', () => {
    const { result } = renderHook(() => useItemPagination(makeItems(25), 10));
    expect(result.current.totalPages).toBe(3);
    expect(result.current.page).toBe(1);
    expect(result.current.visibleItems[0]?.name).toBe('Item 1');
    expect(result.current.visibleItems).toHaveLength(10);
    expect(result.current.rangeStart).toBe(1);
    expect(result.current.rangeEnd).toBe(10);
  });

  it('setPage navigates to the correct slice', () => {
    const { result } = renderHook(() => useItemPagination(makeItems(25), 10));
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    expect(result.current.visibleItems[0]?.name).toBe('Item 11');
    expect(result.current.rangeStart).toBe(11);
    expect(result.current.rangeEnd).toBe(20);
  });

  it('last page can have fewer items', () => {
    const { result } = renderHook(() => useItemPagination(makeItems(25), 10));
    act(() => result.current.setPage(3));
    expect(result.current.visibleItems).toHaveLength(5);
    expect(result.current.rangeStart).toBe(21);
    expect(result.current.rangeEnd).toBe(25);
  });

  it('size "all" collapses to one page with every item', () => {
    const { result } = renderHook(() => useItemPagination(makeItems(42), 'all'));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.visibleItems).toHaveLength(42);
    expect(result.current.rangeStart).toBe(1);
    expect(result.current.rangeEnd).toBe(42);
  });

  it('jumpToLastPage moves to the final page', () => {
    const { result } = renderHook(() => useItemPagination(makeItems(25), 10));
    act(() => result.current.jumpToLastPage());
    expect(result.current.page).toBe(3);
  });

  it('auto-retreats when items shrink past the current page', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: ReturnType<typeof makeItems> }) => useItemPagination(items, 10),
      { initialProps: { items: makeItems(25) } },
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ items: makeItems(15) });
    expect(result.current.page).toBe(2);
  });

  it('clamps page when pageSize grows and the new totalPages is smaller', () => {
    const { result, rerender } = renderHook(
      ({ pageSize }: { pageSize: 10 | 25 }) => useItemPagination(makeItems(25), pageSize),
      { initialProps: { pageSize: 10 } as { pageSize: 10 | 25 } },
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ pageSize: 25 });
    expect(result.current.totalPages).toBe(1);
    expect(result.current.page).toBe(1);
  });

  it('does not retreat when size is "all"', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: ReturnType<typeof makeItems> }) => useItemPagination(items, 'all' as const),
      { initialProps: { items: makeItems(25) } },
    );
    rerender({ items: makeItems(5) });
    expect(result.current.page).toBe(1);
  });

  it('resets to page 1 when a reset signal changes', () => {
    const { result, rerender } = renderHook(
      ({ signal }: { signal: string }) => useItemPagination(makeItems(25), 10, [signal]),
      { initialProps: { signal: 'a' } },
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ signal: 'b' });
    expect(result.current.page).toBe(1);
  });

  it('setPage clamps out-of-range values', () => {
    const { result } = renderHook(() => useItemPagination(makeItems(25), 10));
    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(3);
    act(() => result.current.setPage(0));
    expect(result.current.page).toBe(1);
  });

  it('setPage ignores non-finite values', () => {
    const { result } = renderHook(() => useItemPagination(makeItems(25), 10));
    act(() => result.current.setPage(2));
    act(() => result.current.setPage(Number.NaN));
    expect(result.current.page).toBe(2);
    act(() => result.current.setPage(Number.POSITIVE_INFINITY));
    expect(result.current.page).toBe(2);
  });
});
