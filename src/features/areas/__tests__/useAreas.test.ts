import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    activeLocationId: 'test-location',
    token: 'test-token',
  }),
}));

// Mock notifyBinsChanged to avoid import issues
vi.mock('@/features/bins/useBins', () => ({
  notifyBinsChanged: vi.fn(),
}));

import { apiFetch } from '@/lib/api';
import { createArea, deleteArea, updateArea } from '../useAreas';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createArea', () => {
  it('calls POST with correct endpoint and body', async () => {
    const mockArea = { id: 'area-1', location_id: 'loc-1', name: 'Garage' };
    mockApiFetch.mockResolvedValue(mockArea);

    const result = await createArea('loc-1', 'Garage');

    expect(result).toEqual(mockArea);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1/areas', {
      method: 'POST',
      body: { name: 'Garage' },
    });
  });
});

describe('updateArea', () => {
  it('calls PUT with correct endpoint and body', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await updateArea('loc-1', 'area-1', 'Kitchen');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1/areas/area-1', {
      method: 'PUT',
      body: { name: 'Kitchen' },
    });
  });
});

describe('deleteArea', () => {
  it('calls DELETE with correct endpoint', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await deleteArea('loc-1', 'area-1');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1/areas/area-1', {
      method: 'DELETE',
    });
  });
});
