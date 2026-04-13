import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import { useItemPageSize } from '../useItemPageSize';

const KEY = STORAGE_KEYS.ITEM_PAGE_SIZE;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('useItemPageSize', () => {
  it('returns default 25 when localStorage is empty', () => {
    const { result } = renderHook(() => useItemPageSize());
    expect(result.current.pageSize).toBe(25);
  });

  it('reads a stored numeric value', () => {
    localStorage.setItem(KEY, '50');
    const { result } = renderHook(() => useItemPageSize());
    expect(result.current.pageSize).toBe(50);
  });

  it('reads a stored "all" value', () => {
    localStorage.setItem(KEY, 'all');
    const { result } = renderHook(() => useItemPageSize());
    expect(result.current.pageSize).toBe('all');
  });

  it('falls back to default on malformed stored value', () => {
    localStorage.setItem(KEY, 'foo');
    const { result } = renderHook(() => useItemPageSize());
    expect(result.current.pageSize).toBe(25);
  });

  it('falls back to default on numeric value not in options', () => {
    localStorage.setItem(KEY, '7');
    const { result } = renderHook(() => useItemPageSize());
    expect(result.current.pageSize).toBe(25);
  });

  it('writes to localStorage on setPageSize(50)', () => {
    const { result } = renderHook(() => useItemPageSize());
    act(() => result.current.setPageSize(50));
    expect(localStorage.getItem(KEY)).toBe('50');
    expect(result.current.pageSize).toBe(50);
  });

  it('writes "all" to localStorage', () => {
    const { result } = renderHook(() => useItemPageSize());
    act(() => result.current.setPageSize('all'));
    expect(localStorage.getItem(KEY)).toBe('all');
    expect(result.current.pageSize).toBe('all');
  });

  it('exposes pageSizeOptions [10, 25, 50, 100, "all"]', () => {
    const { result } = renderHook(() => useItemPageSize());
    expect(result.current.pageSizeOptions).toEqual([10, 25, 50, 100, 'all']);
  });
});
