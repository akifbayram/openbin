import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/lib/usePaginatedList', () => ({
  usePaginatedList: vi.fn(() => ({
    items: [],
    totalCount: 0,
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    loadMore: vi.fn(),
    error: null,
  })),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({ activeLocationId: 'loc-1' })),
}));

vi.mock('@/lib/eventBus', () => ({
  Events: { BINS: 'bins-changed' },
}));

import { usePaginatedList } from '@/lib/usePaginatedList';
import { useAuth } from '@/lib/auth';
import { usePaginatedItemList } from '../useItems';

const mockUsePaginatedList = vi.mocked(usePaginatedList);
const mockUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ activeLocationId: 'loc-1' } as ReturnType<typeof useAuth>);
  mockUsePaginatedList.mockReturnValue({
    items: [],
    totalCount: 0,
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    loadMore: vi.fn(),
    error: null,
  });
});

describe('usePaginatedItemList', () => {
  it('constructs basePath with location_id', () => {
    renderHook(() => usePaginatedItemList());

    const basePath = mockUsePaginatedList.mock.calls[0][0] as string;
    expect(basePath).toContain('location_id=loc-1');
    expect(basePath).toMatch(/^\/api\/items\?/);
  });

  it('adds q param when search provided', () => {
    renderHook(() => usePaginatedItemList('cable'));

    const basePath = mockUsePaginatedList.mock.calls[0][0] as string;
    expect(basePath).toContain('q=cable');
  });

  it('adds sort param when not alpha', () => {
    renderHook(() => usePaginatedItemList(undefined, 'bin'));

    const basePath = mockUsePaginatedList.mock.calls[0][0] as string;
    expect(basePath).toContain('sort=bin');
  });

  it('adds sort_dir when desc', () => {
    renderHook(() => usePaginatedItemList(undefined, undefined, 'desc'));

    const basePath = mockUsePaginatedList.mock.calls[0][0] as string;
    expect(basePath).toContain('sort_dir=desc');
  });

  it('passes null basePath when no locationId', () => {
    mockUseAuth.mockReturnValue({ activeLocationId: null } as ReturnType<typeof useAuth>);

    renderHook(() => usePaginatedItemList());

    expect(mockUsePaginatedList).toHaveBeenCalledWith(null, ['bins-changed'], 40);
  });
});
