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
  id: 'abc123', location_id: 'loc-1', name: 'Test Bin', area_id: null, area_name: '',
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

  it('isDirty becomes true after changing items', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    act(() => result.current.setItems(['Item A', 'Item B', 'Item C']));
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

  it('saveEdit calls updateBin with correct payload', async () => {
    vi.mocked(updateBin).mockResolvedValue({} as Bin);
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

  it('setItems adding item grows quantities array', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    // quantities starts as [2, null]
    expect(result.current.quantities).toEqual([2, null]);
    act(() => result.current.setItems(['Item A', 'Item B', 'Item C']));
    expect(result.current.quantities).toEqual([2, null, null]);
  });

  it('setItems removing middle item removes corresponding quantity', () => {
    const { result } = renderHook(() => useEditBinForm('abc123'));
    act(() => result.current.startEdit(mockBin));
    expect(result.current.quantities).toEqual([2, null]);
    // Remove 'Item A' (index 0)
    act(() => result.current.setItems(['Item B']));
    expect(result.current.quantities).toEqual([null]);
  });
});
