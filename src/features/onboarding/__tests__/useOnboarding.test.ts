import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', username: 'testuser', displayName: 'Test', email: null, avatarUrl: null, createdAt: '', updatedAt: '' },
  })),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useOnboarding } from '../useOnboarding';

const mockUseAuth = vi.mocked(useAuth);
const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', username: 'testuser', displayName: 'Test', email: null, avatarUrl: null, createdAt: '', updatedAt: '' },
  } as ReturnType<typeof useAuth>);
  mockApiFetch.mockResolvedValue(null);
});

describe('useOnboarding', () => {
  it('returns initial state when no preferences stored', async () => {
    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.isOnboarding).toBe(true);
    });
    expect(result.current.step).toBe(0);
    expect(result.current.locationId).toBeUndefined();
  });

  it('reads existing state from API', async () => {
    mockApiFetch.mockResolvedValue({
      onboarding_completed: false,
      onboarding_step: 1,
      onboarding_location_id: 'loc-1',
    });

    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.step).toBe(1);
    });
    expect(result.current.locationId).toBe('loc-1');
    expect(result.current.isOnboarding).toBe(true);
  });

  it('advanceWithLocation increments step and stores locationId', async () => {
    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.isOnboarding).toBe(true);
    });

    act(() => {
      result.current.advanceWithLocation('loc-new');
    });

    expect(result.current.step).toBe(1);
    expect(result.current.locationId).toBe('loc-new');
  });

  it('complete sets completed', async () => {
    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.isOnboarding).toBe(true);
    });

    act(() => {
      result.current.complete();
    });

    expect(result.current.isOnboarding).toBe(false);
  });

  it('markFirstScanDone updates firstScanDone', async () => {
    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.firstScanDone).toBe(false);
    });

    act(() => {
      result.current.markFirstScanDone();
    });

    expect(result.current.firstScanDone).toBe(true);
  });
});
