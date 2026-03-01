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

vi.mock('@/features/bins/useBins', () => ({
  notifyBinsChanged: vi.fn(),
}));

import { notifyBinsChanged } from '@/features/bins/useBins';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pinBin, reorderPins, unpinBin, usePinnedBins } from '../usePins';

const mockApiFetch = vi.mocked(apiFetch);
const mockUseAuth = vi.mocked(useAuth);
const mockNotifyBinsChanged = vi.mocked(notifyBinsChanged);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    token: 'test-token',
    activeLocationId: 'loc-1',
  } as ReturnType<typeof useAuth>);
});

describe('usePinnedBins', () => {
  it('fetches pinned bins for active location', async () => {
    const bins = [
      { id: 'bin-1', name: 'Test Bin', location_id: 'loc-1', area_id: null, area_name: '', items: [], notes: '', tags: [], icon: '', color: '', card_style: '', created_by: 'u1', created_by_name: 'User', visibility: 'location' as const, created_at: '', updated_at: '' },
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: 1 });

    const { result } = renderHook(() => usePinnedBins());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/pinned?location_id=loc-1');
    expect(result.current.pinnedBins).toHaveLength(1);
  });

  it('returns empty when no token', async () => {
    mockUseAuth.mockReturnValue({ token: null, activeLocationId: 'loc-1' } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => usePinnedBins());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.pinnedBins).toHaveLength(0);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('returns empty when no activeLocationId', async () => {
    mockUseAuth.mockReturnValue({ token: 'test-token', activeLocationId: null } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => usePinnedBins());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.pinnedBins).toHaveLength(0);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('refetches on pins-changed event', async () => {
    const initial = [
      { id: 'bin-1', name: 'Bin 1', location_id: 'loc-1', area_id: null, area_name: '', items: [], notes: '', tags: [], icon: '', color: '', card_style: '', created_by: 'u1', created_by_name: 'User', visibility: 'location' as const, created_at: '', updated_at: '' },
    ];
    const updated = [
      ...initial,
      { id: 'bin-2', name: 'Bin 2', location_id: 'loc-1', area_id: null, area_name: '', items: [], notes: '', tags: [], icon: '', color: '', card_style: '', created_by: 'u1', created_by_name: 'User', visibility: 'location' as const, created_at: '', updated_at: '' },
    ];
    mockApiFetch
      .mockResolvedValueOnce({ results: initial, count: 1 })
      .mockResolvedValueOnce({ results: updated, count: 2 });

    const { result } = renderHook(() => usePinnedBins());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pinnedBins).toHaveLength(1);

    act(() => {
      window.dispatchEvent(new Event('pins-changed'));
    });

    await waitFor(() => expect(result.current.pinnedBins).toHaveLength(2));
  });
});

describe('pinBin', () => {
  it('POSTs to pin endpoint', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await pinBin('bin-1');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-1/pin', { method: 'POST' });
  });

  it('dispatches pins-changed event and notifies bins-changed', async () => {
    mockApiFetch.mockResolvedValue(undefined);
    const spy = vi.spyOn(window, 'dispatchEvent');

    await pinBin('bin-1');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'pins-changed' }));
    expect(mockNotifyBinsChanged).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('unpinBin', () => {
  it('DELETEs pin endpoint', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await unpinBin('bin-1');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-1/pin', { method: 'DELETE' });
  });

  it('dispatches pins-changed event and notifies bins-changed', async () => {
    mockApiFetch.mockResolvedValue(undefined);
    const spy = vi.spyOn(window, 'dispatchEvent');

    await unpinBin('bin-1');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'pins-changed' }));
    expect(mockNotifyBinsChanged).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('reorderPins', () => {
  it('PUTs with bin_ids', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await reorderPins(['a', 'b']);

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/pinned/reorder', {
      method: 'PUT',
      body: { bin_ids: ['a', 'b'] },
    });
  });

  it('dispatches pins-changed event', async () => {
    mockApiFetch.mockResolvedValue(undefined);
    const spy = vi.spyOn(window, 'dispatchEvent');

    await reorderPins(['a', 'b']);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'pins-changed' }));
    spy.mockRestore();
  });
});
