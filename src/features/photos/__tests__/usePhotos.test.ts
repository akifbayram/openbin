import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    activeLocationId: 'test-location',
    token: 'test-token',
  }),
}));

import { apiFetch } from '@/lib/api';
import { addPhoto, deletePhoto, getPhotoUrl } from '../usePhotos';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('addPhoto', () => {
  it('sends FormData with photo file', async () => {
    mockApiFetch.mockResolvedValue({ id: 'photo-1' });

    const file = new File(['image data'], 'test.jpg', { type: 'image/jpeg' });
    const id = await addPhoto('bin-1', file);

    expect(id).toBe('photo-1');
    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/bin-1/photos', {
      method: 'POST',
      body: expect.any(FormData),
    });
  });
});

describe('deletePhoto', () => {
  it('calls DELETE endpoint', async () => {
    const mockPhoto = { id: 'photo-1', bin_id: 'bin-1' };
    mockApiFetch.mockResolvedValue(mockPhoto);

    const result = await deletePhoto('photo-1');

    expect(result).toEqual(mockPhoto);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/photos/photo-1', {
      method: 'DELETE',
    });
  });
});

describe('getPhotoUrl', () => {
  it('includes token query param when token exists in localStorage', () => {
    localStorage.setItem('openbin-token', 'my-jwt-token');

    expect(getPhotoUrl('photo-123')).toBe(
      `/api/photos/photo-123/file?token=${encodeURIComponent('my-jwt-token')}`,
    );
  });

  it('returns URL without query param when no token', () => {
    expect(getPhotoUrl('photo-123')).toBe('/api/photos/photo-123/file');
  });
});
