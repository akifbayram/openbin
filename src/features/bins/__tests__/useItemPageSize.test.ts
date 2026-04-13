import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import {
  ITEM_PAGE_SIZE_OPTIONS,
  readItemPageSizeFromStorage,
  setItemPageSize,
  useItemPageSize,
} from '../useItemPageSize';

const KEY = STORAGE_KEYS.ITEM_PAGE_SIZE;

beforeEach(() => {
  setItemPageSize(25);
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('readItemPageSizeFromStorage', () => {
  it('returns default 25 when localStorage is empty', () => {
    expect(readItemPageSizeFromStorage()).toBe(25);
  });

  it('reads a stored numeric value', () => {
    localStorage.setItem(KEY, '50');
    expect(readItemPageSizeFromStorage()).toBe(50);
  });

  it('reads a stored "all" value', () => {
    localStorage.setItem(KEY, 'all');
    expect(readItemPageSizeFromStorage()).toBe('all');
  });

  it('falls back to default on malformed stored value', () => {
    localStorage.setItem(KEY, 'foo');
    expect(readItemPageSizeFromStorage()).toBe(25);
  });

  it('falls back to default on numeric value not in options', () => {
    localStorage.setItem(KEY, '7');
    expect(readItemPageSizeFromStorage()).toBe(25);
  });
});

describe('setItemPageSize + useItemPageSize', () => {
  it('writes to localStorage and updates all subscribers', () => {
    const { result } = renderHook(() => useItemPageSize());
    expect(result.current.pageSize).toBe(25);

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

  it('propagates external setItemPageSize changes to mounted hooks', () => {
    const { result } = renderHook(() => useItemPageSize());
    expect(result.current.pageSize).toBe(25);

    act(() => setItemPageSize(100));
    expect(result.current.pageSize).toBe(100);
  });

  it('exposes the fixed option list', () => {
    const { result } = renderHook(() => useItemPageSize());
    expect(result.current.pageSizeOptions).toEqual([10, 25, 50, 100, 'all']);
    expect(ITEM_PAGE_SIZE_OPTIONS).toEqual([10, 25, 50, 100, 'all']);
  });
});
