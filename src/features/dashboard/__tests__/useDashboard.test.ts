import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(() => new Promise(() => {})) }));
vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({ activeLocationId: 'loc-1', token: 'test' })),
}));
vi.mock('@/features/areas/useAreas', () => ({
  useAreaList: vi.fn(() => ({ areas: [], unassignedCount: 0, isLoading: false })),
}));
vi.mock('@/features/bins/useBins', () => ({
  useBinList: vi.fn(() => ({ bins: [], isLoading: false })),
}));
vi.mock('@/features/pins/usePins', () => ({
  usePinnedBins: vi.fn(() => ({ pinnedBins: [] })),
}));
vi.mock('@/lib/dashboardSettings', () => ({
  useDashboardSettings: vi.fn(() => ({
    settings: { recentBinsCount: 5 },
    isLoading: false,
  })),
}));
vi.mock('../scanHistory', () => ({
  useScanHistory: vi.fn(() => ({ history: [], isLoading: false })),
}));
vi.mock('@/features/checkouts/useCheckouts', () => ({
  useLocationCheckouts: vi.fn(() => ({ checkouts: [], isLoading: false })),
}));

import { renderHook } from '@testing-library/react';
import { useLocationCheckouts } from '@/features/checkouts/useCheckouts';
import type { ItemCheckoutWithContext } from '@/types';
import { useDashboard } from '../useDashboard';

const mockUseLocationCheckouts = vi.mocked(useLocationCheckouts);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDashboard', () => {
  it('returns checkoutCount of 0 when no checkouts', () => {
    mockUseLocationCheckouts.mockReturnValue({ checkouts: [], isLoading: false });
    const { result } = renderHook(() => useDashboard());
    expect(result.current.checkoutCount).toBe(0);
  });

  it('returns checkoutCount matching active checkouts', () => {
    mockUseLocationCheckouts.mockReturnValue({
      checkouts: [
        { id: 'co-1', item_id: 'i1', origin_bin_id: 'b1', location_id: 'loc-1', checked_out_by: 'u1', checked_out_by_name: 'Alice', checked_out_at: new Date().toISOString(), returned_at: null, returned_by: null, return_bin_id: null, item_name: 'Item 1', origin_bin_name: 'Bin A', origin_bin_icon: '', origin_bin_color: '' },
        { id: 'co-2', item_id: 'i2', origin_bin_id: 'b2', location_id: 'loc-1', checked_out_by: 'u2', checked_out_by_name: 'Bob', checked_out_at: new Date().toISOString(), returned_at: null, returned_by: null, return_bin_id: null, item_name: 'Item 2', origin_bin_name: 'Bin B', origin_bin_icon: '', origin_bin_color: '' },
      ] as ItemCheckoutWithContext[],
      isLoading: false,
    });
    const { result } = renderHook(() => useDashboard());
    expect(result.current.checkoutCount).toBe(2);
  });

  it('includes checkout loading in composite isLoading', () => {
    mockUseLocationCheckouts.mockReturnValue({ checkouts: [], isLoading: true });
    const { result } = renderHook(() => useDashboard());
    expect(result.current.isLoading).toBe(true);
  });
});
