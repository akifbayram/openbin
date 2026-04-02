import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bin } from '@/types';
import { useEditBinForm } from '../useEditBinForm';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn(() => ({ activeLocationId: 'loc-1', token: 'test' })) }));
vi.mock('@/components/ui/toast', () => ({ useToast: vi.fn(() => ({ showToast: vi.fn() })) }));
vi.mock('../useBins', () => ({ updateBin: vi.fn() }));

const { updateBin } = await import('../useBins');
const { useToast } = await import('@/components/ui/toast');

const mockBin: Bin = {
  id: 'abc123', short_code: 'ABC123', location_id: 'loc-1', name: 'Test Bin', area_id: null, area_name: '',
  items: [{ id: '1', name: 'Item A', quantity: 2 }, { id: '2', name: 'Item B', quantity: null }],
  notes: 'notes', tags: ['tag1'], icon: '', color: '', card_style: '', created_by: 'u1',
  created_by_name: 'User', visibility: 'location', custom_fields: { f1: 'val' },
  created_at: '', updated_at: '',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useEditBinForm', () => {
  it('isDirty is false initially (before startEdit)', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    expect(result.current.isDirty).toBe(false);
    expect(result.current.editing).toBe(false);
  });

  it('isDirty is false right after startEdit', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    expect(result.current.editing).toBe(true);
    expect(result.current.isDirty).toBe(false);
  });

  it('isDirty becomes true after changing name', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    act(() => result.current.setName('Changed'));
    expect(result.current.isDirty).toBe(true);
  });

  it('items are BinItem[] after startEdit', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    expect(result.current.items).toEqual([
      { id: '1', name: 'Item A', quantity: 2 },
      { id: '2', name: 'Item B', quantity: null },
    ]);
  });

  it('isDirty becomes true after changing items', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    act(() => result.current.setItems([
      ...mockBin.items,
      { id: 'new-1', name: 'Item C', quantity: null },
    ]));
    expect(result.current.isDirty).toBe(true);
  });

  it('isDirty detects item quantity change', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    act(() => result.current.setItems([
      { id: '1', name: 'Item A', quantity: 5 },
      { id: '2', name: 'Item B', quantity: null },
    ]));
    expect(result.current.isDirty).toBe(true);
  });

  it('isDirty detects item name change', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    act(() => result.current.setItems([
      { id: '1', name: 'Renamed', quantity: 2 },
      { id: '2', name: 'Item B', quantity: null },
    ]));
    expect(result.current.isDirty).toBe(true);
  });

  it('isDirty becomes true after changing tags', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    act(() => result.current.setTags(['tag1', 'tag2']));
    expect(result.current.isDirty).toBe(true);
  });

  it('isDirty becomes true after changing customFields', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    act(() => result.current.setCustomFields({ f1: 'changed' }));
    expect(result.current.isDirty).toBe(true);
  });

  it('isDirty becomes true after changing notes', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    act(() => result.current.setNotes('different notes'));
    expect(result.current.isDirty).toBe(true);
  });

  it('isDirty becomes true after changing areaId', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    act(() => result.current.setAreaId('area-1'));
    expect(result.current.isDirty).toBe(true);
  });

  it('isDirty becomes true after changing visibility', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    act(() => result.current.setVisibility('private'));
    expect(result.current.isDirty).toBe(true);
  });

  it('isDirty correctly compares arrays regardless of order', () => {
    const bin = { ...mockBin, tags: ['b', 'a'] };
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(bin));
    act(() => result.current.setTags(['a', 'b']));
    expect(result.current.isDirty).toBe(false);
  });

  it('cancelEdit sets editing to false', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    expect(result.current.editing).toBe(true);
    act(() => result.current.cancelEdit());
    expect(result.current.editing).toBe(false);
  });

  it('saveEdit calls updateBin with BinItem[] items', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    await act(() => result.current.saveEdit());
    expect(updateBin).toHaveBeenCalledWith('abc123', {
      name: 'Test Bin',
      areaId: null,
      items: [{ name: 'Item A', quantity: 2 }, { name: 'Item B', quantity: null }],
      notes: 'notes',
      tags: ['tag1'],
      icon: '',
      color: '',
      cardStyle: '',
      visibility: 'location',
      customFields: { f1: 'val' },
    });
    expect(result.current.editing).toBe(false);
  });

  it('saveEdit error does not clear editing state', async () => {
    const showToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({ showToast });
    vi.mocked(updateBin).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    await act(() => result.current.saveEdit());
    expect(result.current.editing).toBe(true);
    expect(showToast).toHaveBeenCalledWith({ message: 'Failed to save changes' });
  });

  it('isDirty is false when items match original by content', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    // Set items to same content but new object references
    act(() => result.current.setItems([
      { id: '1', name: 'Item A', quantity: 2 },
      { id: '2', name: 'Item B', quantity: null },
    ]));
    expect(result.current.isDirty).toBe(false);
  });

  it('saveEdit sends modified items correctly', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    act(() => result.current.setItems([
      { id: '1', name: 'Item A', quantity: 10 },
      { id: 'new-1', name: 'Item C', quantity: 3 },
    ]));
    await act(() => result.current.saveEdit());
    expect(updateBin).toHaveBeenCalledWith('abc123', expect.objectContaining({
      items: [{ name: 'Item A', quantity: 10 }, { name: 'Item C', quantity: 3 }],
    }));
  });
});
