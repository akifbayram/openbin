import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

const { useLocationUsage } = await import('../useLocationUsage');
const { Events } = await import('@/lib/eventBus');

describe('useLocationUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches aggregate usage for the location', async () => {
    mockApiFetch.mockResolvedValueOnce({
      results: [{ date: '2026-04-12', binCount: 4, totalCount: 11 }],
      count: 1,
    });

    const { result } = renderHook(() => useLocationUsage('loc-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.usage).toEqual([{ date: '2026-04-12', binCount: 4, totalCount: 11 }]);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1/usage');
  });

  it('returns empty array when locationId is null', async () => {
    const { result } = renderHook(() => useLocationUsage(null));
    expect(result.current.usage).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('refreshes when BIN_USAGE event fires', async () => {
    mockApiFetch.mockResolvedValue({ results: [], count: 0 });

    renderHook(() => useLocationUsage('loc-1'));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event(Events.BIN_USAGE));
    });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2));
  });
});
