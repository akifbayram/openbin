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
import { Events } from '@/lib/eventBus';
import { usePaginatedList } from '@/lib/usePaginatedList';
import { useBinActivity } from '../useBinActivity';

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

describe('useBinActivity', () => {
  it('constructs basePath with entity_type=bin and entity_id=<binId>', () => {
    renderHook(() => useBinActivity('bin-abc'));

    expect(mockUsePaginatedList).toHaveBeenCalledWith(
      '/api/locations/loc-1/activity?entity_type=bin&entity_id=bin-abc',
      [Events.BINS, Events.PHOTOS, Events.ATTACHMENTS, Events.CHECKOUTS],
      20,
    );
  });

  it('url-encodes the binId', () => {
    renderHook(() => useBinActivity('bin with/slash'));

    expect(mockUsePaginatedList).toHaveBeenCalledWith(
      '/api/locations/loc-1/activity?entity_type=bin&entity_id=bin%20with%2Fslash',
      expect.any(Array),
      20,
    );
  });

  it('passes null basePath when binId is undefined', () => {
    renderHook(() => useBinActivity(undefined));

    expect(mockUsePaginatedList).toHaveBeenCalledWith(
      null,
      expect.any(Array),
      20,
    );
  });

  it('passes null basePath when activeLocationId is null', () => {
    mockUseAuth.mockReturnValue({ activeLocationId: null } as ReturnType<typeof useAuth>);

    renderHook(() => useBinActivity('bin-abc'));

    expect(mockUsePaginatedList).toHaveBeenCalledWith(
      null,
      expect.any(Array),
      20,
    );
  });

  it('accepts a custom pageSize', () => {
    renderHook(() => useBinActivity('bin-abc', 5));

    expect(mockUsePaginatedList).toHaveBeenCalledWith(
      '/api/locations/loc-1/activity?entity_type=bin&entity_id=bin-abc',
      expect.any(Array),
      5,
    );
  });

  it('renames items to entries in the returned value', () => {
    const mockEntries = [
      {
        id: 'a1', location_id: 'loc-1', user_id: 'u1',
        user_name: 'user', display_name: 'User', action: 'create',
        entity_type: 'bin', entity_id: 'bin-abc', entity_name: 'Box',
        changes: null, auth_method: 'jwt' as const, api_key_name: null,
        created_at: '',
      },
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

    const { result } = renderHook(() => useBinActivity('bin-abc'));

    expect(result.current.entries).toEqual(mockEntries);
  });
});
