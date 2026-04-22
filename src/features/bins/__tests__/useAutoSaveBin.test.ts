import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bin } from '@/types';
import { useAutoSaveBin } from '../useAutoSaveBin';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn(() => ({ activeLocationId: 'loc-1', token: 'test' })) }));
vi.mock('@/components/ui/toast', () => ({ useToast: vi.fn(() => ({ showToast: vi.fn() })) }));
vi.mock('../useBins', () => ({ updateBin: vi.fn() }));

const { updateBin } = await import('../useBins');
const { useToast } = await import('@/components/ui/toast');

const mockBin: Bin = {
  id: 'abc123', short_code: 'ABC123', location_id: 'loc-1', name: 'Test Bin',
  area_id: null, area_name: '', items: [], notes: 'old notes', tags: ['tag1'],
  icon: 'Package', color: '', card_style: '', created_by: 'u1',
  created_by_name: 'User', visibility: 'location', custom_fields: {},
  created_at: '', updated_at: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutoSaveBin', () => {
  it('returns save functions and empty status sets', () => {
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    expect(typeof result.current.saveNotes).toBe('function');
    expect(typeof result.current.saveTags).toBe('function');
    expect(typeof result.current.saveName).toBe('function');
    expect(typeof result.current.saveAreaId).toBe('function');
    expect(typeof result.current.saveIcon).toBe('function');
    expect(typeof result.current.saveColor).toBe('function');
    expect(typeof result.current.saveCardStyle).toBe('function');
    expect(typeof result.current.saveVisibility).toBe('function');
    expect(typeof result.current.saveCustomFields).toBe('function');
    expect(result.current.savedFields.size).toBe(0);
    expect(result.current.savingFields.size).toBe(0);
  });

  it('saveNotes calls updateBin after debounce', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    act(() => result.current.saveNotes('new notes'));
    expect(updateBin).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(350); });
    expect(updateBin).toHaveBeenCalledWith('abc123', { notes: 'new notes' });
  });

  it('skips save when value unchanged from bin prop', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    act(() => result.current.saveNotes('old notes'));
    await act(async () => { vi.advanceTimersByTime(350); });
    expect(updateBin).not.toHaveBeenCalled();
  });

  it('saveTags calls updateBin immediately (no debounce)', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    await act(async () => { result.current.saveTags(['tag1', 'tag2']); });
    expect(updateBin).toHaveBeenCalledWith('abc123', { tags: ['tag1', 'tag2'] });
  });

  it('tracks savedFields after successful save', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    await act(async () => { result.current.saveTags(['new']); });
    expect(result.current.savedFields.has('tags')).toBe(true);
    act(() => { vi.advanceTimersByTime(650); });
    expect(result.current.savedFields.has('tags')).toBe(false);
  });

  it('shows error toast on save failure', async () => {
    const showToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({ showToast, updateToast: vi.fn() });
    vi.mocked(updateBin).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    await act(async () => { result.current.saveTags(['fail']); });
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Failed'),
    }));
  });

  it('does nothing when bin is null', async () => {
    const { result } = renderHook(() => useAutoSaveBin(null));
    await act(async () => { result.current.saveNotes('test'); });
    await act(async () => { vi.advanceTimersByTime(350); });
    expect(updateBin).not.toHaveBeenCalled();
  });

  it('debounce resets on rapid calls', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    act(() => result.current.saveNotes('first'));
    act(() => { vi.advanceTimersByTime(100); });
    act(() => result.current.saveNotes('second'));
    act(() => { vi.advanceTimersByTime(100); });
    act(() => result.current.saveNotes('third'));
    await act(async () => { vi.advanceTimersByTime(350); });
    expect(updateBin).toHaveBeenCalledTimes(1);
    expect(updateBin).toHaveBeenCalledWith('abc123', { notes: 'third' });
  });

  it('saveIcon calls updateBin immediately', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    await act(async () => { result.current.saveIcon('Box'); });
    expect(updateBin).toHaveBeenCalledWith('abc123', { icon: 'Box' });
  });

  it('saveColor debounces for drag scenarios', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    act(() => result.current.saveColor('h:10:s:2'));
    act(() => { vi.advanceTimersByTime(100); });
    act(() => result.current.saveColor('h:20:s:2'));
    act(() => { vi.advanceTimersByTime(100); });
    act(() => result.current.saveColor('h:30:s:2'));
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(updateBin).toHaveBeenCalledTimes(1);
    expect(updateBin).toHaveBeenCalledWith('abc123', { color: 'h:30:s:2' });
  });

  it('saveVisibility calls updateBin immediately', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    await act(async () => { result.current.saveVisibility('private'); });
    expect(updateBin).toHaveBeenCalledWith('abc123', { visibility: 'private' });
  });

  it('saveCustomFields calls updateBin immediately', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    await act(async () => { result.current.saveCustomFields({ f1: 'val1' }); });
    expect(updateBin).toHaveBeenCalledWith('abc123', { customFields: { f1: 'val1' } });
  });

  it('saveAreaId calls updateBin immediately', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    await act(async () => { result.current.saveAreaId('area-1'); });
    expect(updateBin).toHaveBeenCalledWith('abc123', { areaId: 'area-1' });
  });

  it('saveCardStyle debounces like color', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSaveBin(mockBin));
    act(() => result.current.saveCardStyle('{"variant":"border"}'));
    act(() => { vi.advanceTimersByTime(100); });
    act(() => result.current.saveCardStyle('{"variant":"gradient"}'));
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(updateBin).toHaveBeenCalledTimes(1);
    expect(updateBin).toHaveBeenCalledWith('abc123', { cardStyle: '{"variant":"gradient"}' });
  });

  it('flushes pending debounced saves on unmount', async () => {
    vi.mocked(updateBin).mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useAutoSaveBin(mockBin));
    act(() => result.current.saveNotes('pending'));
    unmount();
    expect(updateBin).toHaveBeenCalledWith('abc123', { notes: 'pending' });
  });
});
