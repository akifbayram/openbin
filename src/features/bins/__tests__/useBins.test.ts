import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiFetch
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

// Mock useAuth
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    activeLocationId: 'test-location',
    token: 'test-token',
  }),
}));

import { apiFetch } from '@/lib/api';
import { addBin, updateBin, deleteBin, restoreBin } from '../useBins';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addBin', () => {
  it('calls apiFetch with correct parameters', async () => {
    mockApiFetch.mockResolvedValue({ id: 'new-id' });

    const id = await addBin({
      name: 'My Bin',
      locationId: 'location-1',
      items: ['stuff'],
      notes: 'some notes',
      tags: ['electronics'],
      icon: 'Wrench',
      color: 'blue',
    });

    expect(id).toBe('new-id');
    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins', {
      method: 'POST',
      body: {
        locationId: 'location-1',
        name: 'My Bin',
        areaId: null,
        items: ['stuff'],
        notes: 'some notes',
        tags: ['electronics'],
        icon: 'Wrench',
        color: 'blue',
        cardStyle: '',
        visibility: 'location',
      },
    });
  });

  it('uses default values for optional fields', async () => {
    mockApiFetch.mockResolvedValue({ id: 'new-id' });

    await addBin({ name: 'Minimal', locationId: 'location-1' });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins', {
      method: 'POST',
      body: {
        locationId: 'location-1',
        name: 'Minimal',
        areaId: null,
        items: [],
        notes: '',
        tags: [],
        icon: '',
        color: '',
        cardStyle: '',
        visibility: 'location',
      },
    });
  });

  it('passes areaId when provided', async () => {
    mockApiFetch.mockResolvedValue({ id: 'new-id' });

    await addBin({ name: 'With Area', locationId: 'location-1', areaId: 'area-1' });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins', {
      method: 'POST',
      body: expect.objectContaining({
        areaId: 'area-1',
      }),
    });
  });
});

describe('updateBin', () => {
  it('calls apiFetch with PUT method', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await updateBin('bin-1', { name: 'Updated', tags: ['new'] });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-1', {
      method: 'PUT',
      body: { name: 'Updated', tags: ['new'] },
    });
  });

  it('sends areaId in update', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await updateBin('bin-1', { areaId: 'area-2' });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-1', {
      method: 'PUT',
      body: { areaId: 'area-2' },
    });
  });
});

describe('deleteBin', () => {
  it('calls apiFetch with DELETE method', async () => {
    const mockBin = { id: 'bin-1', name: 'Deleted' };
    mockApiFetch.mockResolvedValue(mockBin);

    const result = await deleteBin('bin-1');

    expect(result).toEqual(mockBin);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-1', {
      method: 'DELETE',
    });
  });
});

describe('restoreBin', () => {
  it('calls the restore endpoint with the bin id', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await restoreBin({
      id: 'restored-bin',
      location_id: 'location-1',
      name: 'Restored',
      area_id: 'area-1',
      area_name: 'Garage',
      items: [],
      notes: '',
      tags: [],
      icon: '',
      color: '',
      card_style: '',
      short_code: 'A3K7NP',
      created_by: 'user-1',
      created_by_name: '',
      visibility: 'location',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/restored-bin/restore', {
      method: 'POST',
    });
  });
});
