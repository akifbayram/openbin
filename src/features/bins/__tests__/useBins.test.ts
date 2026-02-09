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
    activeHomeId: 'test-home',
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
      homeId: 'home-1',
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
        homeId: 'home-1',
        name: 'My Bin',
        location: '',
        items: ['stuff'],
        notes: 'some notes',
        tags: ['electronics'],
        icon: 'Wrench',
        color: 'blue',
      },
    });
  });

  it('uses default values for optional fields', async () => {
    mockApiFetch.mockResolvedValue({ id: 'new-id' });

    await addBin({ name: 'Minimal', homeId: 'home-1' });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins', {
      method: 'POST',
      body: {
        homeId: 'home-1',
        name: 'Minimal',
        location: '',
        items: [],
        notes: '',
        tags: [],
        icon: '',
        color: '',
      },
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
  it('calls apiFetch with POST and includes bin id', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await restoreBin({
      id: 'restored-bin',
      home_id: 'home-1',
      name: 'Restored',
      location: '',
      items: [],
      notes: '',
      tags: [],
      icon: '',
      color: '',
      created_by: 'user-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins', {
      method: 'POST',
      body: expect.objectContaining({
        id: 'restored-bin',
        homeId: 'home-1',
        name: 'Restored',
      }),
    });
  });
});
