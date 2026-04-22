import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiFetch = vi.fn();
const mockNotify = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));
vi.mock('@/lib/eventBus', () => ({
  Events: { BINS: 'BINS', CHECKOUTS: 'CHECKOUTS' },
  notify: (...a: unknown[]) => mockNotify(...a),
}));

import { useItemBulkActions } from '../useItemBulkActions';

describe('useItemBulkActions', () => {
  let clearSelection: () => void;
  type ToastArg = {
    message: string;
    variant?: 'error' | 'success';
    action?: { label: string; onClick: () => void };
  };
  let showToast: ReturnType<typeof vi.fn> & ((toast: ToastArg) => void);

  beforeEach(() => {
    vi.clearAllMocks();
    clearSelection = vi.fn();
    showToast = vi.fn() as ReturnType<typeof vi.fn> & ((toast: ToastArg) => void);
  });

  it('bulkDelete posts to /api/items/bulk-delete and clears selection', async () => {
    mockApiFetch.mockResolvedValue({ deleted: 2 });
    const { result } = renderHook(() => useItemBulkActions(clearSelection, showToast));
    await act(() => result.current.bulkDelete(['a', 'b']));
    expect(mockApiFetch).toHaveBeenCalledWith('/api/items/bulk-delete', { method: 'POST', body: { ids: ['a', 'b'] } });
    expect(clearSelection).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Deleted 2 items' }));
    expect(mockNotify).toHaveBeenCalledWith('BINS');
  });

  it('bulkDelete toast includes Undo action calling bulk-restore', async () => {
    mockApiFetch.mockResolvedValueOnce({ deleted: 2 });
    const { result } = renderHook(() => useItemBulkActions(clearSelection, showToast));
    await act(() => result.current.bulkDelete(['a', 'b']));
    const toastArg = showToast.mock.calls[0][0];
    expect(toastArg.action.label).toBe('Undo');

    mockApiFetch.mockResolvedValueOnce({ restored: 2 });
    await act(() => toastArg.action.onClick());
    expect(mockApiFetch).toHaveBeenLastCalledWith('/api/items/bulk-restore', { method: 'POST', body: { ids: ['a', 'b'] } });
  });

  it('bulkCheckout reports partial errors via toast', async () => {
    mockApiFetch.mockResolvedValue({ checkedOut: 1, errors: [{ id: 'a', reason: 'ALREADY_CHECKED_OUT' }] });
    const { result } = renderHook(() => useItemBulkActions(clearSelection, showToast));
    await act(() => result.current.bulkCheckout(['a', 'b']));
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Checked out 1 item. 1 failed.' }));
    expect(mockNotify).toHaveBeenCalledWith('CHECKOUTS');
  });

  it('bulkMove sends targetBinId and reports name in toast', async () => {
    mockApiFetch.mockResolvedValue({ moved: 3 });
    const { result } = renderHook(() => useItemBulkActions(clearSelection, showToast));
    await act(() => result.current.bulkMove(['a', 'b', 'c'], 'bin-target', 'Garage A'));
    expect(mockApiFetch).toHaveBeenCalledWith('/api/items/bulk-move', { method: 'POST', body: { ids: ['a', 'b', 'c'], targetBinId: 'bin-target' } });
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Moved 3 items to Garage A' }));
  });

  it('bulkQuantity sends op + value', async () => {
    mockApiFetch.mockResolvedValue({ updated: 3, removed: 1 });
    const { result } = renderHook(() => useItemBulkActions(clearSelection, showToast));
    await act(() => result.current.bulkQuantity(['a', 'b', 'c'], 'set', 5));
    expect(mockApiFetch).toHaveBeenCalledWith('/api/items/bulk-quantity', { method: 'POST', body: { ids: ['a', 'b', 'c'], op: 'set', value: 5 } });
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Updated 3 items. 1 removed.' }));
  });

  it('isBusy toggles around the call', async () => {
    let resolveCall!: (v: unknown) => void;
    mockApiFetch.mockReturnValue(new Promise((res) => { resolveCall = res; }));
    const { result } = renderHook(() => useItemBulkActions(clearSelection, showToast));
    expect(result.current.isBusy).toBe(false);
    let p: Promise<void>;
    act(() => { p = result.current.bulkDelete(['a']); });
    expect(result.current.isBusy).toBe(true);
    await act(async () => {
      resolveCall({ deleted: 1 });
      await p!;
    });
    expect(result.current.isBusy).toBe(false);
  });
});
