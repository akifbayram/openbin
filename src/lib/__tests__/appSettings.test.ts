import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({
    activeLocationId: 'loc-1',
  })),
}));

vi.mock('@/features/locations/useLocations', () => ({
  useLocationList: vi.fn(() => ({
    locations: [],
    isLoading: false,
  })),
  updateLocation: vi.fn(),
}));

import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLocationList, updateLocation } from '@/features/locations/useLocations';
import { useAppSettings } from '@/lib/appSettings';

const mockUseAuth = vi.mocked(useAuth);
const mockUseLocationList = vi.mocked(useLocationList);
const mockUpdateLocation = vi.mocked(updateLocation);

describe('useAppSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      activeLocationId: 'loc-1',
    } as ReturnType<typeof useAuth>);
    mockUseLocationList.mockReturnValue({
      locations: [],
      isLoading: false,
      refresh: vi.fn(),
    });
  });

  it('returns defaults when no active location', () => {
    const { result } = renderHook(() => useAppSettings());
    expect(result.current.settings).toEqual({ appName: 'Sanduk' });
  });

  it('reads app_name from active location', () => {
    mockUseLocationList.mockReturnValue({
      locations: [
        { id: 'loc-1', name: 'Home', app_name: 'Custom', created_by: 'u1', invite_code: '', activity_retention_days: 90, trash_retention_days: 30, created_at: '', updated_at: '' },
      ] as any,
      isLoading: false,
      refresh: vi.fn(),
    });

    const { result } = renderHook(() => useAppSettings());
    expect(result.current.settings.appName).toBe('Custom');
  });

  it('falls back to Sanduk when location has no app_name', () => {
    mockUseLocationList.mockReturnValue({
      locations: [
        { id: 'loc-1', name: 'Home', created_by: 'u1', invite_code: '', activity_retention_days: 90, trash_retention_days: 30, created_at: '', updated_at: '' },
      ] as any,
      isLoading: false,
      refresh: vi.fn(),
    });

    const { result } = renderHook(() => useAppSettings());
    expect(result.current.settings.appName).toBe('Sanduk');
  });

  it('updateSettings calls updateLocation', () => {
    const { result } = renderHook(() => useAppSettings());

    act(() => {
      result.current.updateSettings({ appName: 'NewName' });
    });

    expect(mockUpdateLocation).toHaveBeenCalledWith('loc-1', { app_name: 'NewName' });
  });

  it('resetSettings calls updateLocation with Sanduk', () => {
    const { result } = renderHook(() => useAppSettings());

    act(() => {
      result.current.resetSettings();
    });

    expect(mockUpdateLocation).toHaveBeenCalledWith('loc-1', { app_name: 'Sanduk' });
  });
});
