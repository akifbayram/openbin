import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { useAuth } from '@/lib/auth';
import { usePaginatedList } from '@/lib/usePaginatedList';
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

  it('appends user_id filter to basePath', () => {
    renderHook(() => usePaginatedActivityLog('', 'user-123'));

    expect(mockUsePaginatedList).toHaveBeenCalledWith(
      '/api/locations/loc-1/activity?user_id=user-123',
      [],
      50,
    );
  });

  it('appends date range filters to basePath', () => {
    renderHook(() => usePaginatedActivityLog('', '', '2026-04-01', '2026-04-07'));

    expect(mockUsePaginatedList).toHaveBeenCalledWith(
      '/api/locations/loc-1/activity?from=2026-04-01&to=2026-04-07',
      [],
      50,
    );
  });

  it('combines entity_type and user_id filters', () => {
    renderHook(() => usePaginatedActivityLog('bin', 'user-123'));

    expect(mockUsePaginatedList).toHaveBeenCalledWith(
      '/api/locations/loc-1/activity?entity_type=bin&user_id=user-123',
      [],
      50,
    );
  });

  it('combines all filters', () => {
    renderHook(() => usePaginatedActivityLog('bin', 'user-123', '2026-04-01', '2026-04-07'));

    expect(mockUsePaginatedList).toHaveBeenCalledWith(
      '/api/locations/loc-1/activity?entity_type=bin&user_id=user-123&from=2026-04-01&to=2026-04-07',
      [],
      50,
    );
  });
});
