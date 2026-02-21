import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import React from 'react';

const { mockLocationsContext } = vi.hoisted(() => {
  const { createContext } = require('react');
  return { mockLocationsContext: createContext(null) };
});

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
  LocationsContext: mockLocationsContext,
}));

import { useAuth } from '@/lib/auth';
import { updateLocation } from '@/features/locations/useLocations';
import { useAppSettings } from '@/lib/appSettings';

const mockUseAuth = vi.mocked(useAuth);
const mockUpdateLocation = vi.mocked(updateLocation);

function makeWrapper(locations: any[] = [], isLoading = false) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(mockLocationsContext.Provider, { value: { locations, isLoading } }, children);
  };
}

describe('useAppSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      activeLocationId: 'loc-1',
    } as ReturnType<typeof useAuth>);
  });

  it('returns defaults when no active location', () => {
    const { result } = renderHook(() => useAppSettings(), { wrapper: makeWrapper() });
    expect(result.current.settings).toEqual({ appName: 'OpenBin', termBin: '', termLocation: '', termArea: '' });
  });

  it('reads app_name from active location', () => {
    const locations = [
      { id: 'loc-1', name: 'Home', app_name: 'Custom', created_by: 'u1', invite_code: '', activity_retention_days: 90, trash_retention_days: 30, created_at: '', updated_at: '' },
    ];

    const { result } = renderHook(() => useAppSettings(), { wrapper: makeWrapper(locations) });
    expect(result.current.settings.appName).toBe('Custom');
  });

  it('falls back to OpenBin when location has no app_name', () => {
    const locations = [
      { id: 'loc-1', name: 'Home', created_by: 'u1', invite_code: '', activity_retention_days: 90, trash_retention_days: 30, created_at: '', updated_at: '' },
    ];

    const { result } = renderHook(() => useAppSettings(), { wrapper: makeWrapper(locations) });
    expect(result.current.settings.appName).toBe('OpenBin');
  });

  it('updateSettings calls updateLocation', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAppSettings(), { wrapper: makeWrapper() });

    act(() => {
      result.current.updateSettings({ appName: 'NewName' });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockUpdateLocation).toHaveBeenCalledWith('loc-1', { app_name: 'NewName' });
    vi.useRealTimers();
  });

  it('resetSettings calls updateLocation with OpenBin', () => {
    const { result } = renderHook(() => useAppSettings(), { wrapper: makeWrapper() });

    act(() => {
      result.current.resetSettings();
    });

    expect(mockUpdateLocation).toHaveBeenCalledWith('loc-1', { app_name: 'OpenBin', term_bin: '', term_location: '', term_area: '' });
  });
});
