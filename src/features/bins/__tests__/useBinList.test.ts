import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}));

import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Bin } from '@/types';
import {
  countActiveFilters,
  EMPTY_FILTERS,
  lookupBinByCode,
  useBinList,
  useBin,
  useAllTags,
} from '../useBins';
import type { BinFilters } from '../useBins';

const mockApiFetch = vi.mocked(apiFetch);
const mockUseAuth = vi.mocked(useAuth);

function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'bin-1',
    location_id: 'loc-1',
    name: 'Test Bin',
    area_id: null,
    area_name: '',
    items: [],
    notes: '',
    tags: [],
    icon: '',
    color: '',
    short_code: 'A1B2C3',
    created_by: 'user-1',
    created_by_name: '',
    visibility: 'location',
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    ...overrides,
  };
}

function authWith(token: string | null, activeLocationId: string | null) {
  mockUseAuth.mockReturnValue({
    token,
    activeLocationId,
    user: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setActiveLocationId: vi.fn(),
    updateUser: vi.fn(),
    deleteAccount: vi.fn(),
  } as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  vi.clearAllMocks();
  authWith('test-token', 'test-location');
});

// ---------------------------------------------------------------------------
// countActiveFilters
// ---------------------------------------------------------------------------
describe('countActiveFilters', () => {
  it('returns 0 for EMPTY_FILTERS', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it('counts tags, colors, areas, hasItems, hasNotes independently', () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, tags: ['a'] })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, colors: ['blue'] })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, areas: ['area-1'] })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, hasItems: true })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, hasNotes: true })).toBe(1);

    expect(
      countActiveFilters({
        tags: ['a'],
        tagMode: 'any',
        colors: ['blue'],
        areas: ['area-1'],
        hasItems: true,
        hasNotes: true,
      }),
    ).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// lookupBinByCode
// ---------------------------------------------------------------------------
describe('lookupBinByCode', () => {
  it('calls correct endpoint with encoded shortCode', async () => {
    const bin = makeBin();
    mockApiFetch.mockResolvedValue(bin);

    const result = await lookupBinByCode('A1/B2');

    expect(result).toEqual(bin);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/lookup/A1%2FB2');
  });
});

// ---------------------------------------------------------------------------
// useBinList
// ---------------------------------------------------------------------------
describe('useBinList', () => {
  it('returns empty array and not loading when no token', async () => {
    authWith(null, 'test-location');

    const { result } = renderHook(() => useBinList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toEqual([]);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('returns empty array and not loading when no activeLocationId', async () => {
    authWith('test-token', null);

    const { result } = renderHook(() => useBinList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toEqual([]);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('fetches bins with correct location_id query param', async () => {
    const bins = [makeBin()];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const { result } = renderHook(() => useBinList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins?location_id=test-location');
    expect(result.current.bins).toEqual(bins);
  });

  it('handles API error by returning empty array', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBinList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toEqual([]);
  });

  // -- search ---------------------------------------------------------------
  it('search: filters by name (case-insensitive)', async () => {
    const bins = [makeBin({ id: '1', name: 'Kitchen Drawer' }), makeBin({ id: '2', name: 'Garage Shelf' })];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const { result } = renderHook(() => useBinList('kitchen'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(result.current.bins[0].name).toBe('Kitchen Drawer');
  });

  it('search: filters by area_name', async () => {
    const bins = [
      makeBin({ id: '1', name: 'Bin A', area_name: 'Garage' }),
      makeBin({ id: '2', name: 'Bin B', area_name: 'Basement' }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const { result } = renderHook(() => useBinList('garage'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(result.current.bins[0].id).toBe('1');
  });

  it('search: filters by items array entries', async () => {
    const bins = [
      makeBin({ id: '1', name: 'Bin A', items: [{ id: 'i1', name: 'Hammer' }, { id: 'i2', name: 'Nails' }] }),
      makeBin({ id: '2', name: 'Bin B', items: [{ id: 'i3', name: 'Screws' }] }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const { result } = renderHook(() => useBinList('hammer'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(result.current.bins[0].id).toBe('1');
  });

  it('search: filters by notes', async () => {
    const bins = [
      makeBin({ id: '1', name: 'Bin A', notes: 'Contains fragile items' }),
      makeBin({ id: '2', name: 'Bin B', notes: '' }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const { result } = renderHook(() => useBinList('fragile'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(result.current.bins[0].id).toBe('1');
  });

  it('search: filters by tags', async () => {
    const bins = [
      makeBin({ id: '1', name: 'Bin A', tags: ['electronics', 'cables'] }),
      makeBin({ id: '2', name: 'Bin B', tags: ['tools'] }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const { result } = renderHook(() => useBinList('electronics'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(result.current.bins[0].id).toBe('1');
  });

  it('search: filters by short_code', async () => {
    const bins = [
      makeBin({ id: '1', name: 'Bin A', short_code: 'XY7Z9K' }),
      makeBin({ id: '2', name: 'Bin B', short_code: 'AB3CD4' }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const { result } = renderHook(() => useBinList('xy7z'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(result.current.bins[0].id).toBe('1');
  });

  // -- filters --------------------------------------------------------------
  it('filters — tags any: matches if any tag present', async () => {
    const bins = [
      makeBin({ id: '1', tags: ['electronics', 'cables'] }),
      makeBin({ id: '2', tags: ['tools'] }),
      makeBin({ id: '3', tags: [] }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const filters: BinFilters = { ...EMPTY_FILTERS, tags: ['cables', 'tools'], tagMode: 'any' };
    const { result } = renderHook(() => useBinList(undefined, 'updated', filters));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(2);
    const ids = result.current.bins.map((b) => b.id);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
  });

  it('filters — tags all: matches only if all tags present', async () => {
    const bins = [
      makeBin({ id: '1', tags: ['electronics', 'cables'] }),
      makeBin({ id: '2', tags: ['electronics'] }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const filters: BinFilters = { ...EMPTY_FILTERS, tags: ['electronics', 'cables'], tagMode: 'all' };
    const { result } = renderHook(() => useBinList(undefined, 'updated', filters));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(result.current.bins[0].id).toBe('1');
  });

  it('filters — colors: filters by color set', async () => {
    const bins = [
      makeBin({ id: '1', color: 'blue' }),
      makeBin({ id: '2', color: 'red' }),
      makeBin({ id: '3', color: '' }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const filters: BinFilters = { ...EMPTY_FILTERS, colors: ['blue', 'red'] };
    const { result } = renderHook(() => useBinList(undefined, 'updated', filters));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(2);
    const ids = result.current.bins.map((b) => b.id);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
  });

  it('filters — areas: filters by area_id set', async () => {
    const bins = [
      makeBin({ id: '1', area_id: 'area-1' }),
      makeBin({ id: '2', area_id: 'area-2' }),
      makeBin({ id: '3', area_id: null }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const filters: BinFilters = { ...EMPTY_FILTERS, areas: ['area-1'] };
    const { result } = renderHook(() => useBinList(undefined, 'updated', filters));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(result.current.bins[0].id).toBe('1');
  });

  it('filters — areas __unassigned__: matches bins with null area_id', async () => {
    const bins = [
      makeBin({ id: '1', area_id: 'area-1' }),
      makeBin({ id: '2', area_id: null }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const filters: BinFilters = { ...EMPTY_FILTERS, areas: ['__unassigned__'] };
    const { result } = renderHook(() => useBinList(undefined, 'updated', filters));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(result.current.bins[0].id).toBe('2');
  });

  it('filters — hasItems: only bins with non-empty items array', async () => {
    const bins = [
      makeBin({ id: '1', items: [{ id: 'i1', name: 'Hammer' }] }),
      makeBin({ id: '2', items: [] }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const filters: BinFilters = { ...EMPTY_FILTERS, hasItems: true };
    const { result } = renderHook(() => useBinList(undefined, 'updated', filters));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(result.current.bins[0].id).toBe('1');
  });

  it('filters — hasNotes: only bins with non-empty trimmed notes', async () => {
    const bins = [
      makeBin({ id: '1', notes: 'Some note' }),
      makeBin({ id: '2', notes: '' }),
      makeBin({ id: '3', notes: '   ' }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const filters: BinFilters = { ...EMPTY_FILTERS, hasNotes: true };
    const { result } = renderHook(() => useBinList(undefined, 'updated', filters));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(result.current.bins[0].id).toBe('1');
  });

  // -- sort -----------------------------------------------------------------
  it('sort name: alphabetical by name', async () => {
    const bins = [
      makeBin({ id: '1', name: 'Charlie' }),
      makeBin({ id: '2', name: 'Alpha' }),
      makeBin({ id: '3', name: 'Bravo' }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const { result } = renderHook(() => useBinList(undefined, 'name'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins.map((b) => b.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('sort created: newest first by created_at', async () => {
    const bins = [
      makeBin({ id: '1', name: 'Old', created_at: '2024-01-01T00:00:00Z' }),
      makeBin({ id: '2', name: 'New', created_at: '2024-06-01T00:00:00Z' }),
      makeBin({ id: '3', name: 'Mid', created_at: '2024-03-01T00:00:00Z' }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const { result } = renderHook(() => useBinList(undefined, 'created'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins.map((b) => b.name)).toEqual(['New', 'Mid', 'Old']);
  });

  it('sort updated: newest first by updated_at (default)', async () => {
    const bins = [
      makeBin({ id: '1', name: 'Old', updated_at: '2024-01-01T00:00:00Z' }),
      makeBin({ id: '2', name: 'New', updated_at: '2024-06-01T00:00:00Z' }),
      makeBin({ id: '3', name: 'Mid', updated_at: '2024-03-01T00:00:00Z' }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const { result } = renderHook(() => useBinList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins.map((b) => b.name)).toEqual(['New', 'Mid', 'Old']);
  });

  // -- event refresh --------------------------------------------------------
  it('event refresh: bins-changed event triggers refetch', async () => {
    mockApiFetch.mockResolvedValue({ results: [makeBin({ id: '1', name: 'Original' })], count: 1 });

    const { result } = renderHook(() => useBinList());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bins).toHaveLength(1);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    mockApiFetch.mockResolvedValue({ results: [
      makeBin({ id: '1', name: 'Original' }),
      makeBin({ id: '2', name: 'New Bin' }),
    ], count: 2 });

    act(() => {
      window.dispatchEvent(new Event('bins-changed'));
    });

    await waitFor(() => {
      expect(result.current.bins).toHaveLength(2);
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// useBin
// ---------------------------------------------------------------------------
describe('useBin', () => {
  it('fetches single bin by id', async () => {
    const bin = makeBin({ id: 'bin-42' });
    mockApiFetch.mockResolvedValue(bin);

    const { result } = renderHook(() => useBin('bin-42'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bin).toEqual(bin);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-42');
  });

  it('returns undefined when no id', async () => {
    const { result } = renderHook(() => useBin(undefined));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bin).toBeUndefined();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('returns undefined on API error (bin ?? undefined masks null)', async () => {
    mockApiFetch.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useBin('bin-404'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bin).toBeUndefined();
  });

  it('listens to bins-changed for refresh', async () => {
    const bin = makeBin({ id: 'bin-1', name: 'V1' });
    mockApiFetch.mockResolvedValue(bin);

    const { result } = renderHook(() => useBin('bin-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    const updatedBin = makeBin({ id: 'bin-1', name: 'V2' });
    mockApiFetch.mockResolvedValue(updatedBin);

    act(() => {
      window.dispatchEvent(new Event('bins-changed'));
    });

    await waitFor(() => {
      expect(result.current.bin?.name).toBe('V2');
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// useAllTags
// ---------------------------------------------------------------------------
describe('useAllTags', () => {
  it('extracts and deduplicates tags from all bins, sorted', async () => {
    const bins = [
      makeBin({ id: '1', tags: ['beta', 'alpha'] }),
      makeBin({ id: '2', tags: ['gamma', 'alpha'] }),
      makeBin({ id: '3', tags: [] }),
    ];
    mockApiFetch.mockResolvedValue({ results: bins, count: bins.length });

    const { result } = renderHook(() => useAllTags());

    await waitFor(() => {
      expect(result.current.length).toBeGreaterThan(0);
    });
    expect(result.current).toEqual(['alpha', 'beta', 'gamma']);
  });
});
