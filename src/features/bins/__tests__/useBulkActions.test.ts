import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Bin } from '@/types';
import type { Terminology } from '@/lib/terminology';

const mockNavigate = vi.fn();

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({ activeLocationId: 'loc-1' })),
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));
vi.mock('@/features/pins/usePins', () => ({
  pinBin: vi.fn(() => Promise.resolve()),
  unpinBin: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/features/bins/useBins', () => ({
  deleteBin: vi.fn(() => Promise.resolve()),
  restoreBin: vi.fn(() => Promise.resolve()),
  addBin: vi.fn(() => Promise.resolve({ id: 'new-1' })),
}));
vi.mock('@/lib/utils', () => ({
  haptic: vi.fn(),
}));

import { useBulkActions } from '../useBulkActions';
import { deleteBin, restoreBin, addBin } from '@/features/bins/useBins';
import { pinBin, unpinBin } from '@/features/pins/usePins';
import { useAuth } from '@/lib/auth';

function makeBin(overrides: Partial<Bin> & { id: string }): Bin {
  return {
    location_id: 'loc-1',
    name: 'Bin',
    area_id: null,
    area_name: '',
    items: [],
    notes: '',
    tags: [],
    icon: '',
    color: '',
    card_style: '',
    created_by: 'u1',
    created_by_name: 'User',
    visibility: 'location',
    custom_fields: {},
    created_at: '',
    updated_at: '',
    is_pinned: false,
    ...overrides,
  };
}

const t: Terminology = {
  bin: 'bin',
  bins: 'bins',
  Bin: 'Bin',
  Bins: 'Bins',
  location: 'location',
  locations: 'locations',
  Location: 'Location',
  Locations: 'Locations',
  area: 'area',
  areas: 'areas',
  Area: 'Area',
  Areas: 'Areas',
};

describe('useBulkActions', () => {
  let clearSelection: ReturnType<typeof vi.fn>;
  let showToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearSelection = vi.fn();
    showToast = vi.fn();
    (addBin as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-1' });
  });

  it('bulkDelete calls deleteBin for each selected bin', async () => {
    const bins = [makeBin({ id: 'a' }), makeBin({ id: 'b' }), makeBin({ id: 'c' })];
    const selected = new Set(['a', 'c']);
    const { result } = renderHook(() => useBulkActions(bins, selected, clearSelection, showToast, t));

    await act(() => result.current.bulkDelete());

    expect(deleteBin).toHaveBeenCalledTimes(2);
    expect(deleteBin).toHaveBeenCalledWith('a');
    expect(deleteBin).toHaveBeenCalledWith('c');
  });

  it('bulkDelete with empty selection is no-op', async () => {
    const bins = [makeBin({ id: 'a' })];
    const selected = new Set<string>();
    const { result } = renderHook(() => useBulkActions(bins, selected, clearSelection, showToast, t));

    await act(() => result.current.bulkDelete());

    expect(deleteBin).not.toHaveBeenCalled();
  });

  it('bulkDelete calls clearSelection and showToast', async () => {
    const bins = [makeBin({ id: 'a', name: 'Alpha' })];
    const selected = new Set(['a']);
    const { result } = renderHook(() => useBulkActions(bins, selected, clearSelection, showToast, t));

    await act(() => result.current.bulkDelete());

    expect(clearSelection).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Deleted 1 bin' }),
    );
  });

  it('bulkDuplicate calls addBin for each selected bin', async () => {
    let callCount = 0;
    (addBin as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      return Promise.resolve({ id: `new-${callCount}` });
    });
    const bins = [makeBin({ id: 'a', name: 'A' }), makeBin({ id: 'b', name: 'B' })];
    const selected = new Set(['a', 'b']);
    const { result } = renderHook(() => useBulkActions(bins, selected, clearSelection, showToast, t));

    await act(() => result.current.bulkDuplicate());

    expect(addBin).toHaveBeenCalledTimes(2);
  });

  it('bulkDuplicate navigates to new bin when single selection', async () => {
    const bins = [makeBin({ id: 'a', name: 'Alpha' })];
    const selected = new Set(['a']);
    const { result } = renderHook(() => useBulkActions(bins, selected, clearSelection, showToast, t));

    await act(() => result.current.bulkDuplicate());

    expect(mockNavigate).toHaveBeenCalledWith('/bin/new-1');
    expect(showToast).toHaveBeenCalledWith({ message: 'Duplicated "Alpha"' });
  });

  it('bulkDuplicate does nothing when no activeLocationId', async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ activeLocationId: null });
    const bins = [makeBin({ id: 'a' })];
    const selected = new Set(['a']);
    const { result } = renderHook(() => useBulkActions(bins, selected, clearSelection, showToast, t));

    await act(() => result.current.bulkDuplicate());

    expect(addBin).not.toHaveBeenCalled();
  });

  it('bulkPinToggle pins when majority are unpinned', async () => {
    const bins = [
      makeBin({ id: 'a', is_pinned: false }),
      makeBin({ id: 'b', is_pinned: true }),
      makeBin({ id: 'c', is_pinned: false }),
    ];
    const selected = new Set(['a', 'b', 'c']);
    const { result } = renderHook(() => useBulkActions(bins, selected, clearSelection, showToast, t));

    await act(() => result.current.bulkPinToggle());

    expect(pinBin).toHaveBeenCalledTimes(2);
    expect(pinBin).toHaveBeenCalledWith('a');
    expect(pinBin).toHaveBeenCalledWith('c');
    expect(unpinBin).not.toHaveBeenCalled();
  });

  it('bulkPinToggle unpins when majority are pinned', async () => {
    const bins = [
      makeBin({ id: 'a', is_pinned: true }),
      makeBin({ id: 'b', is_pinned: true }),
      makeBin({ id: 'c', is_pinned: false }),
    ];
    const selected = new Set(['a', 'b', 'c']);
    const { result } = renderHook(() => useBulkActions(bins, selected, clearSelection, showToast, t));

    await act(() => result.current.bulkPinToggle());

    expect(unpinBin).toHaveBeenCalledTimes(2);
    expect(unpinBin).toHaveBeenCalledWith('a');
    expect(unpinBin).toHaveBeenCalledWith('b');
    expect(pinBin).not.toHaveBeenCalled();
  });

  it('bulkDelete rejects when deleteBin throws for one bin', async () => {
    (deleteBin as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));
    const bins = [makeBin({ id: 'a' }), makeBin({ id: 'b' })];
    const selected = new Set(['a', 'b']);
    const { result } = renderHook(() => useBulkActions(bins, selected, clearSelection, showToast, t));

    await expect(act(() => result.current.bulkDelete())).rejects.toThrow('network error');
  });

  it('bulkDuplicate rejects when addBin throws', async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ activeLocationId: 'loc-1' });
    (addBin as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('duplicate failed'));
    const bins = [makeBin({ id: 'a', name: 'A' })];
    const selected = new Set(['a']);
    const { result } = renderHook(() => useBulkActions(bins, selected, clearSelection, showToast, t));

    await expect(act(() => result.current.bulkDuplicate())).rejects.toThrow('duplicate failed');
  });

  it('pinLabel is Pin when majority unpinned, Unpin when majority pinned', () => {
    const unpinnedBins = [makeBin({ id: 'a', is_pinned: false }), makeBin({ id: 'b', is_pinned: false })];
    const pinnedBins = [makeBin({ id: 'a', is_pinned: true }), makeBin({ id: 'b', is_pinned: true })];
    const ids = new Set(['a', 'b']);

    const { result: r1 } = renderHook(() => useBulkActions(unpinnedBins, ids, clearSelection, showToast, t));
    expect(r1.current.pinLabel).toBe('Pin');

    const { result: r2 } = renderHook(() => useBulkActions(pinnedBins, ids, clearSelection, showToast, t));
    expect(r2.current.pinLabel).toBe('Unpin');
  });
});
