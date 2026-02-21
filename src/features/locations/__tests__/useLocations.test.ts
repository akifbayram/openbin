import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({
    token: 'test-token',
  })),
}));

import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  LocationProvider,
  useLocationList,
  useLocationMembers,
  createLocation,
  updateLocation,
  deleteLocation,
  joinLocation,
  leaveLocation,
  removeMember,
  regenerateInvite,
} from '../useLocations';

const mockApiFetch = vi.mocked(apiFetch);
const mockUseAuth = vi.mocked(useAuth);

function locationWrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(LocationProvider, null, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    token: 'test-token',
  } as ReturnType<typeof useAuth>);
});

describe('useLocationList', () => {
  it('fetches locations when token is present', async () => {
    const locations = [
      { id: 'loc-1', name: 'Home', created_by: 'u1', invite_code: 'abc', created_at: '', updated_at: '' },
    ];
    mockApiFetch.mockResolvedValue({ results: locations, count: locations.length });

    const { result } = renderHook(() => useLocationList(), { wrapper: locationWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locations).toEqual(locations);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations');
  });

  it('returns empty array when no token', async () => {
    mockUseAuth.mockReturnValue({ token: null } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useLocationList(), { wrapper: locationWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locations).toEqual([]);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('returns empty array on API error', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLocationList(), { wrapper: locationWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locations).toEqual([]);
  });

  it('refetches when locations-changed event fires', async () => {
    const initial = [{ id: 'loc-1', name: 'Home', created_by: 'u1', invite_code: 'abc', created_at: '', updated_at: '' }];
    const updated = [
      { id: 'loc-1', name: 'Home', created_by: 'u1', invite_code: 'abc', created_at: '', updated_at: '' },
      { id: 'loc-2', name: 'Office', created_by: 'u1', invite_code: 'def', created_at: '', updated_at: '' },
    ];
    mockApiFetch.mockResolvedValueOnce({ results: initial, count: initial.length }).mockResolvedValueOnce({ results: updated, count: updated.length });

    const { result } = renderHook(() => useLocationList(), { wrapper: locationWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.locations).toEqual(initial);

    act(() => {
      window.dispatchEvent(new Event('locations-changed'));
    });

    await waitFor(() => expect(result.current.locations).toEqual(updated));
  });
});

describe('useLocationMembers', () => {
  it('fetches members for a locationId', async () => {
    const members = [
      { id: 'm1', location_id: 'loc-1', user_id: 'u1', role: 'admin' as const, joined_at: '' },
    ];
    mockApiFetch.mockResolvedValue({ results: members, count: members.length });

    const { result } = renderHook(() => useLocationMembers('loc-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.members).toEqual(members);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1/members');
  });

  it('returns empty array when no locationId', async () => {
    const { result } = renderHook(() => useLocationMembers(null));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.members).toEqual([]);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('returns empty array when no token', async () => {
    mockUseAuth.mockReturnValue({ token: null } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useLocationMembers('loc-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.members).toEqual([]);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('returns empty array on API error', async () => {
    mockApiFetch.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useLocationMembers('loc-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.members).toEqual([]);
  });
});

describe('createLocation', () => {
  it('POSTs with name and returns Location', async () => {
    const loc = { id: 'loc-new', name: 'Garage', created_by: 'u1', invite_code: 'xyz', created_at: '', updated_at: '' };
    mockApiFetch.mockResolvedValue(loc);

    const result = await createLocation('Garage');

    expect(result).toEqual(loc);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations', {
      method: 'POST',
      body: { name: 'Garage' },
    });
  });

  it('fires locations-changed event', async () => {
    mockApiFetch.mockResolvedValue({ id: 'loc-1' });
    const spy = vi.spyOn(window, 'dispatchEvent');

    await createLocation('Test');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'locations-changed' }));
    spy.mockRestore();
  });
});

describe('updateLocation', () => {
  it('PUTs with id and payload', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await updateLocation('loc-1', { name: 'New Name' });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1', {
      method: 'PUT',
      body: { name: 'New Name' },
    });
  });

  it('fires locations-changed event', async () => {
    mockApiFetch.mockResolvedValue(undefined);
    const spy = vi.spyOn(window, 'dispatchEvent');

    await updateLocation('loc-1', { name: 'New Name' });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'locations-changed' }));
    spy.mockRestore();
  });
});

describe('deleteLocation', () => {
  it('calls DELETE endpoint', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await deleteLocation('loc-1');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1', {
      method: 'DELETE',
    });
  });

  it('fires locations-changed event', async () => {
    mockApiFetch.mockResolvedValue(undefined);
    const spy = vi.spyOn(window, 'dispatchEvent');

    await deleteLocation('loc-1');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'locations-changed' }));
    spy.mockRestore();
  });
});

describe('joinLocation', () => {
  it('POSTs with inviteCode and returns Location', async () => {
    const loc = { id: 'loc-2', name: 'Office', created_by: 'u2', invite_code: 'inv', created_at: '', updated_at: '' };
    mockApiFetch.mockResolvedValue(loc);

    const result = await joinLocation('inv');

    expect(result).toEqual(loc);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/join', {
      method: 'POST',
      body: { inviteCode: 'inv' },
    });
  });

  it('fires locations-changed event', async () => {
    mockApiFetch.mockResolvedValue({ id: 'loc-2' });
    const spy = vi.spyOn(window, 'dispatchEvent');

    await joinLocation('abc');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'locations-changed' }));
    spy.mockRestore();
  });
});

describe('leaveLocation', () => {
  it('calls DELETE member endpoint', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await leaveLocation('loc-1', 'user-1');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1/members/user-1', {
      method: 'DELETE',
    });
  });

  it('fires locations-changed event', async () => {
    mockApiFetch.mockResolvedValue(undefined);
    const spy = vi.spyOn(window, 'dispatchEvent');

    await leaveLocation('loc-1', 'user-1');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'locations-changed' }));
    spy.mockRestore();
  });
});

describe('removeMember', () => {
  it('calls DELETE member endpoint', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await removeMember('loc-1', 'user-2');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1/members/user-2', {
      method: 'DELETE',
    });
  });

  it('fires locations-changed event', async () => {
    mockApiFetch.mockResolvedValue(undefined);
    const spy = vi.spyOn(window, 'dispatchEvent');

    await removeMember('loc-1', 'user-2');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'locations-changed' }));
    spy.mockRestore();
  });
});

describe('regenerateInvite', () => {
  it('POSTs and returns new invite code', async () => {
    mockApiFetch.mockResolvedValue({ inviteCode: 'new-code' });

    const result = await regenerateInvite('loc-1');

    expect(result).toEqual({ inviteCode: 'new-code' });
    expect(mockApiFetch).toHaveBeenCalledWith('/api/locations/loc-1/regenerate-invite', {
      method: 'POST',
    });
  });

  it('fires locations-changed event', async () => {
    mockApiFetch.mockResolvedValue({ inviteCode: 'new-code' });
    const spy = vi.spyOn(window, 'dispatchEvent');

    await regenerateInvite('loc-1');

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'locations-changed' }));
    spy.mockRestore();
  });
});
