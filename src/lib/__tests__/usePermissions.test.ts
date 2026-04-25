import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/locations/useLocations', () => ({ useLocationList: vi.fn() }));

import { useLocationList } from '@/features/locations/useLocations';
import { useAuth } from '@/lib/auth';
import type { Location } from '@/types';
import { usePermissions } from '../usePermissions';

const mockUseAuth = vi.mocked(useAuth);
const mockUseLocationList = vi.mocked(useLocationList);

function setup(role: string | undefined, userId = 'user1', locationId = 'loc1') {
  mockUseAuth.mockReturnValue({
    user: userId ? { id: userId } : null,
    activeLocationId: locationId,
  } as ReturnType<typeof useAuth>);

  const locations = role
    ? [{ id: locationId, role } as Pick<Location, 'id' | 'role'>]
    : [];

  mockUseLocationList.mockReturnValue({ locations, isLoading: false } as ReturnType<typeof useLocationList>);
}

describe('usePermissions', () => {
  it('admin role: all admin permissions true', () => {
    setup('admin');
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isMember).toBe(false);
    expect(result.current.isViewer).toBe(false);
    expect(result.current.canWrite).toBe(true);
    expect(result.current.canDeleteBin('other-user')).toBe(true);
    expect(result.current.canDeleteBin('user1')).toBe(true);
    expect(result.current.canManageAreas).toBe(true);
    expect(result.current.canManageMembers).toBe(true);
    expect(result.current.canCreateBin).toBe(true);
    expect(result.current.canPin).toBe(true);
  });

  it('admin: canEditBin returns true regardless of createdBy', () => {
    setup('admin');
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEditBin('other-user')).toBe(true);
    expect(result.current.canEditBin('user1')).toBe(true);
  });

  it('member role: member permissions', () => {
    setup('member');
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isMember).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.canWrite).toBe(true);
    expect(result.current.canDeleteBin('other-user')).toBe(false);
    expect(result.current.canDeleteBin('user1')).toBe(true);
    expect(result.current.canManageAreas).toBe(false);
    expect(result.current.canCreateBin).toBe(true);
    expect(result.current.canPin).toBe(true);
  });

  it('member: canEditBin true only for own bins', () => {
    setup('member');
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEditBin('user1')).toBe(true);
    expect(result.current.canEditBin('other-user')).toBe(false);
  });

  it('viewer: canDeleteBin false even for own bins', () => {
    setup('viewer');
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canDeleteBin('user1')).toBe(false);
    expect(result.current.canDeleteBin('other-user')).toBe(false);
  });

  it('viewer role: read-only permissions', () => {
    setup('viewer');
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isViewer).toBe(true);
    expect(result.current.canWrite).toBe(false);
    expect(result.current.canEditBin('other-user')).toBe(false);
    expect(result.current.canCreateBin).toBe(false);
    expect(result.current.canPin).toBe(false);
    expect(result.current.canEditItems).toBe(false);
  });

  it('canChangeVisibility: true only when createdBy matches user id', () => {
    setup('admin');
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canChangeVisibility('user1')).toBe(true);
    expect(result.current.canChangeVisibility('other-user')).toBe(false);
  });

  it('no active location: all permissions false/undefined', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user1' },
      activeLocationId: 'missing',
    } as ReturnType<typeof useAuth>);
    mockUseLocationList.mockReturnValue({ locations: [{ id: 'loc1', role: 'admin' } as Pick<Location, 'id' | 'role'>], isLoading: false } as ReturnType<typeof useLocationList>);

    const { result } = renderHook(() => usePermissions());
    expect(result.current.role).toBeUndefined();
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.canWrite).toBe(false);
    expect(result.current.canDeleteBin('user1')).toBe(false);
    expect(result.current.canCreateBin).toBe(false);
  });

  it('null user: canEditBin and canChangeVisibility always false', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      activeLocationId: 'loc1',
    } as ReturnType<typeof useAuth>);
    mockUseLocationList.mockReturnValue({ locations: [{ id: 'loc1', role: 'member' } as Pick<Location, 'id' | 'role'>], isLoading: false } as ReturnType<typeof useLocationList>);

    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEditBin('anyone')).toBe(false);
    expect(result.current.canChangeVisibility('anyone')).toBe(false);
  });

  it('isLoading passes through from useLocationList', () => {
    setup('admin');
    mockUseLocationList.mockReturnValue({ locations: [], isLoading: true, error: null, refresh: vi.fn() } as ReturnType<typeof useLocationList>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isLoading).toBe(true);
  });
});
