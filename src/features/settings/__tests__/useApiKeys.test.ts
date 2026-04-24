import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiKeys } from '../useApiKeys';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(() => Promise.resolve({ results: [], count: 0 })),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({ token: 'test-token' })),
}));

describe('useApiKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches when enabled (default)', async () => {
    renderHook(() => useApiKeys());
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/api-keys'));
  });

  it('skips fetch when disabled — prevents Pro-gated 403 for free users', async () => {
    const { result } = renderHook(() => useApiKeys(false));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.current.keys).toEqual([]);
  });

  it('skips fetch when token is missing', async () => {
    vi.mocked(useAuth).mockReturnValue({ token: null } as unknown as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => useApiKeys(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
