import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({
    token: 'test-token',
    activeLocationId: 'loc-1',
  })),
}));

import { apiFetch } from '@/lib/api';
import { checkoutItem, returnItem, useCheckouts, useLocationCheckouts } from '../useCheckouts';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkoutItem', () => {
  it('calls correct endpoint and returns checkout', async () => {
    const checkout = { id: 'co-1', item_id: 'item-1', origin_bin_id: 'bin-1' };
    mockApiFetch.mockResolvedValue({ checkout });

    const result = await checkoutItem('bin-1', 'item-1');

    expect(result).toEqual(checkout);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-1/items/item-1/checkout', {
      method: 'POST',
    });
  });
});

describe('returnItem', () => {
  it('calls return endpoint without targetBinId', async () => {
    const checkout = { id: 'co-1', returned_at: '2026-01-01' };
    mockApiFetch.mockResolvedValue({ checkout });

    const result = await returnItem('bin-1', 'item-1');

    expect(result).toEqual(checkout);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-1/items/item-1/return', {
      method: 'POST',
      body: {},
    });
  });

  it('passes targetBinId when provided', async () => {
    const checkout = { id: 'co-1', return_bin_id: 'bin-2' };
    mockApiFetch.mockResolvedValue({ checkout });

    await returnItem('bin-1', 'item-1', 'bin-2');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-1/items/item-1/return', {
      method: 'POST',
      body: { targetBinId: 'bin-2' },
    });
  });
});

describe('useCheckouts', () => {
  it('fetches active checkouts for a bin', async () => {
    const checkouts = [{ id: 'co-1', item_id: 'item-1' }];
    mockApiFetch.mockResolvedValue({ results: checkouts, count: 1 });

    const { result } = renderHook(() => useCheckouts('bin-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.checkouts).toEqual(checkouts);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-1/checkouts');
  });

  it('refreshes on checkouts-changed event', async () => {
    const initial = [{ id: 'co-1' }];
    const updated = [{ id: 'co-1' }, { id: 'co-2' }];
    mockApiFetch
      .mockResolvedValueOnce({ results: initial, count: 1 })
      .mockResolvedValueOnce({ results: updated, count: 2 });

    const { result } = renderHook(() => useCheckouts('bin-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.checkouts).toEqual(initial);

    act(() => {
      window.dispatchEvent(new Event('checkouts-changed'));
    });

    await waitFor(() => expect(result.current.checkouts).toEqual(updated));
  });
});

describe('useLocationCheckouts', () => {
  it('fetches checkouts across location', async () => {
    const checkouts = [
      { id: 'co-1', item_name: 'Widget', origin_bin_name: 'Bin A' },
    ];
    mockApiFetch.mockResolvedValue({ results: checkouts, count: 1 });

    const { result } = renderHook(() => useLocationCheckouts('loc-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.checkouts).toEqual(checkouts);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1/checkouts');
  });
});
