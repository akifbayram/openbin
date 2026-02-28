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

import { usePaginatedList } from '@/lib/usePaginatedList';
import { useAuth } from '@/lib/auth';
import { usePaginatedActivityLog } from '../useActivity';

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

describe('usePaginatedActivityLog', () => {
  it('constructs basePath with locationId', () => {
    renderHook(() => usePaginatedActivityLog());

    expect(mockUsePaginatedList).toHaveBeenCalledWith(
      '/api/locations/loc-1/activity',
      [],
      50,
    );
  });

  it('appends entity_type filter to basePath', () => {
    renderHook(() => usePaginatedActivityLog('bin'));

    expect(mockUsePaginatedList).toHaveBeenCalledWith(
      '/api/locations/loc-1/activity?entity_type=bin',
      [],
      50,
    );
  });

  it('passes null basePath when no locationId', () => {
    mockUseAuth.mockReturnValue({ activeLocationId: null } as ReturnType<typeof useAuth>);

    renderHook(() => usePaginatedActivityLog());

    expect(mockUsePaginatedList).toHaveBeenCalledWith(null, [], 50);
  });

  it('returns entries from usePaginatedList items', () => {
    const mockEntries = [
      { id: 'a1', location_id: 'loc-1', user_id: 'u1', user_name: 'user', display_name: 'User', action: 'create', entity_type: 'bin', entity_id: 'b1', entity_name: 'Box', changes: null, auth_method: 'jwt' as const, api_key_name: null, created_at: '' },
    ];
    mockUsePaginatedList.mockReturnValue({
      items: mockEntries,
      totalCount: 1,
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      loadMore: vi.fn(),
      error: null,
    });

    const { result } = renderHook(() => usePaginatedActivityLog());

    expect(result.current.entries).toEqual(mockEntries);
    expect(result.current.totalCount).toBe(1);
  });
});
