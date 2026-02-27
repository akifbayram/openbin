import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

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
import { useOnboarding, ONBOARDING_TOTAL_STEPS } from '../useOnboarding';
import { UserPreferencesProvider } from '@/lib/userPreferences';

const mockUseAuth = vi.mocked(useAuth);
const mockApiFetch = vi.mocked(apiFetch);

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(UserPreferencesProvider, null, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', username: 'testuser', displayName: 'Test', email: null, avatarUrl: null, createdAt: '', updatedAt: '' },
  } as ReturnType<typeof useAuth>);
  mockApiFetch.mockResolvedValue(null);
});

describe('useOnboarding', () => {
  it('returns initial state when no preferences stored', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

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

    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.step).toBe(1);
    });
    expect(result.current.locationId).toBe('loc-1');
    expect(result.current.isOnboarding).toBe(true);
  });

  it('advanceWithLocation increments step and stores locationId', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

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
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.isOnboarding).toBe(true);
    });

    act(() => {
      result.current.complete();
    });

    expect(result.current.isOnboarding).toBe(false);
  });

  it('markFirstScanDone updates firstScanDone', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.firstScanDone).toBe(false);
    });

    act(() => {
      result.current.markFirstScanDone();
    });

    expect(result.current.firstScanDone).toBe(true);
  });

  it('advanceStep increments step', async () => {
    mockApiFetch.mockResolvedValue({
      onboarding_completed: false,
      onboarding_step: 2,
    });

    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.step).toBe(2);
    });

    act(() => {
      result.current.advanceStep();
    });

    expect(result.current.step).toBe(3);
    expect(result.current.isOnboarding).toBe(true);
  });

  it('advanceStep on last step completes onboarding', async () => {
    mockApiFetch.mockResolvedValue({
      onboarding_completed: false,
      onboarding_step: ONBOARDING_TOTAL_STEPS - 1,
    });

    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.step).toBe(ONBOARDING_TOTAL_STEPS - 1);
    });

    act(() => {
      result.current.advanceStep();
    });

    expect(result.current.isOnboarding).toBe(false);
  });

  it('full flow from step 0 through completion (5 steps)', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.isOnboarding).toBe(true);
      expect(result.current.step).toBe(0);
    });

    // Step 0 -> 1: advance with location
    act(() => {
      result.current.advanceWithLocation('loc-1');
    });
    expect(result.current.step).toBe(1);

    // Step 1 -> 2: advance step (after bin creation success)
    act(() => {
      result.current.advanceStep();
    });
    expect(result.current.step).toBe(2);

    // Step 2 -> 3: QR preview -> AI showcase
    act(() => {
      result.current.advanceStep();
    });
    expect(result.current.step).toBe(3);

    // Step 3 -> 4: AI showcase -> Completion
    act(() => {
      result.current.advanceStep();
    });
    expect(result.current.step).toBe(4);

    // Step 4 -> completed
    act(() => {
      result.current.advanceStep();
    });
    expect(result.current.isOnboarding).toBe(false);
  });
});
