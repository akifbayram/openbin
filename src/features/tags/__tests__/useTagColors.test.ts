import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

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
import { useAuth } from '@/lib/auth';
import { useTagColors, setTagColor, removeTagColor } from '../useTagColors';

const mockApiFetch = vi.mocked(apiFetch);
const mockUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    token: 'test-token',
    activeLocationId: 'loc-1',
  } as ReturnType<typeof useAuth>);
});

describe('useTagColors', () => {
  it('fetches tag colors for active location', async () => {
    const rawColors = [
      { id: 'tc-1', location_id: 'loc-1', tag: 'electronics', color: 'blue', created_at: '', updated_at: '' },
      { id: 'tc-2', location_id: 'loc-1', tag: 'tools', color: 'red', created_at: '', updated_at: '' },
    ];
    mockApiFetch.mockResolvedValue({ results: rawColors, count: rawColors.length });

    const { result } = renderHook(() => useTagColors());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiFetch).toHaveBeenCalledWith('/api/tag-colors?location_id=loc-1');
  });

  it('returns empty map when no token', async () => {
    mockUseAuth.mockReturnValue({ token: null, activeLocationId: 'loc-1' } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useTagColors());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tagColors.size).toBe(0);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('returns empty map when no activeLocationId', async () => {
    mockUseAuth.mockReturnValue({ token: 'test-token', activeLocationId: null } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useTagColors());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tagColors.size).toBe(0);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('maps raw TagColor[] to Map<tag, color>', async () => {
    const rawColors = [
      { id: 'tc-1', location_id: 'loc-1', tag: 'electronics', color: 'blue', created_at: '', updated_at: '' },
      { id: 'tc-2', location_id: 'loc-1', tag: 'tools', color: 'red', created_at: '', updated_at: '' },
    ];
    mockApiFetch.mockResolvedValue({ results: rawColors, count: rawColors.length });

    const { result } = renderHook(() => useTagColors());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tagColors.get('electronics')).toBe('blue');
    expect(result.current.tagColors.get('tools')).toBe('red');
    expect(result.current.tagColors.size).toBe(2);
  });

  it('handles API error with empty map', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTagColors());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tagColors.size).toBe(0);
  });

  it('refetches when tag-colors-changed event fires', async () => {
    const initial = [
      { id: 'tc-1', location_id: 'loc-1', tag: 'tools', color: 'blue', created_at: '', updated_at: '' },
    ];
    const updated = [
      { id: 'tc-1', location_id: 'loc-1', tag: 'tools', color: 'blue', created_at: '', updated_at: '' },
      { id: 'tc-2', location_id: 'loc-1', tag: 'food', color: 'green', created_at: '', updated_at: '' },
    ];
    mockApiFetch.mockResolvedValueOnce({ results: initial, count: initial.length }).mockResolvedValueOnce({ results: updated, count: updated.length });

    const { result } = renderHook(() => useTagColors());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tagColors.size).toBe(1);

    act(() => {
      window.dispatchEvent(new Event('tag-colors-changed'));
    });

    await waitFor(() => expect(result.current.tagColors.size).toBe(2));
  });
});

describe('setTagColor', () => {
  it('PUTs with locationId, tag, and color', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await setTagColor('loc-1', 'electronics', 'blue');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/tag-colors', {
      method: 'PUT',
      body: { locationId: 'loc-1', tag: 'electronics', color: 'blue' },
    });
  });

  it('fires tag-colors-changed event', async () => {
    mockApiFetch.mockResolvedValue(undefined);
    const spy = vi.spyOn(window, 'dispatchEvent');

    await setTagColor('loc-1', 'electronics', 'blue');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'tag-colors-changed' }));
    spy.mockRestore();
  });
});

describe('removeTagColor', () => {
  it('DELETEs with encoded tag and location_id query', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await removeTagColor('loc-1', 'my tag');

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/tag-colors/${encodeURIComponent('my tag')}?location_id=${encodeURIComponent('loc-1')}`,
      { method: 'DELETE' },
    );
  });

  it('fires tag-colors-changed event', async () => {
    mockApiFetch.mockResolvedValue(undefined);
    const spy = vi.spyOn(window, 'dispatchEvent');

    await removeTagColor('loc-1', 'tools');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'tag-colors-changed' }));
    spy.mockRestore();
  });
});
