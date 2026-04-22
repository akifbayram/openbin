import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiFetch = vi.fn();
const mockNotify = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));
vi.mock('@/lib/eventBus', () => ({
  Events: { BINS: 'BINS', CHECKOUTS: 'CHECKOUTS' },
  notify: (...a: unknown[]) => mockNotify(...a),
}));

import { useCheckoutBulkActions } from '../useCheckoutBulkActions';

describe('useCheckoutBulkActions', () => {
  type ToastArg = { message: string; variant?: 'error' | 'success' };
  let clearSelection: () => void;
  let showToast: ReturnType<typeof vi.fn> & ((toast: ToastArg) => void);
  beforeEach(() => {
    vi.clearAllMocks();
    clearSelection = vi.fn();
    showToast = vi.fn() as ReturnType<typeof vi.fn> & ((toast: ToastArg) => void);
  });

  it('bulkReturn (no target) posts and toasts', async () => {
    mockApiFetch.mockResolvedValue({ returned: 3, errors: [] });
    const { result } = renderHook(() => useCheckoutBulkActions('loc-1', clearSelection, showToast));
    await act(() => result.current.bulkReturn(['co-1', 'co-2', 'co-3']));
    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1/checkouts/bulk-return', {
      method: 'POST', body: { checkoutIds: ['co-1', 'co-2', 'co-3'] },
    });
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Returned 3 items' }));
    expect(mockNotify).toHaveBeenCalledWith('CHECKOUTS');
  });

  it('bulkReturnToBin includes targetBinId and bin name in toast', async () => {
    mockApiFetch.mockResolvedValue({ returned: 2, errors: [] });
    const { result } = renderHook(() => useCheckoutBulkActions('loc-1', clearSelection, showToast));
    await act(() => result.current.bulkReturnToBin(['co-1', 'co-2'], 'bin-x', 'Garage A'));
    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1/checkouts/bulk-return', {
      method: 'POST', body: { checkoutIds: ['co-1', 'co-2'], targetBinId: 'bin-x' },
    });
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Returned 2 items to Garage A' }));
  });

  it('reports partial errors in toast', async () => {
    mockApiFetch.mockResolvedValue({ returned: 1, errors: [{ id: 'co-2', reason: 'NOT_FOUND' }] });
    const { result } = renderHook(() => useCheckoutBulkActions('loc-1', clearSelection, showToast));
    await act(() => result.current.bulkReturn(['co-1', 'co-2']));
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Returned 1 item. 1 failed.' }));
  });
});
