import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  ApiError: class ApiError extends Error {
    constructor(public status: number, msg: string) { super(msg); }
  },
}));

const { useBinUsage } = await import('../useBinUsage');
const { Events } = await import('@/lib/eventBus');

describe('useBinUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches usage data for the given binId', async () => {
    mockApiFetch.mockResolvedValueOnce({
      results: [{ date: '2026-04-12', count: 3 }],
      count: 1,
    });

    const { result } = renderHook(() => useBinUsage('bin-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.usage).toEqual([{ date: '2026-04-12', count: 3 }]);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-1/usage');
  });

  it('returns empty array when binId is null', async () => {
    const { result } = renderHook(() => useBinUsage(null));
    expect(result.current.usage).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('refreshes when BIN_USAGE event fires', async () => {
    mockApiFetch.mockResolvedValue({ results: [], count: 0 });

    renderHook(() => useBinUsage('bin-1'));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event(Events.BIN_USAGE));
    });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2));
  });
});
