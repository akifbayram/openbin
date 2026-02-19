import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import { useListData } from '@/lib/useListData';
import type { Location, LocationMember } from '@/types';

function notifyLocationsChanged() {
  notify(Events.LOCATIONS);
}

export function useLocationList() {
  const { token } = useAuth();
  const { data: locations, isLoading, refresh } = useListData<Location>(
    token ? '/api/locations' : null,
    [Events.LOCATIONS],
  );
  return { locations, isLoading, refresh };
}

export function useLocationMembers(locationId: string | null) {
  const { token } = useAuth();
  const { data: members, isLoading } = useListData<LocationMember>(
    locationId && token ? `/api/locations/${locationId}/members` : null,
    [Events.LOCATIONS],
  );
  return { members, isLoading };
}

export async function createLocation(name: string): Promise<Location> {
  const location = await apiFetch<Location>('/api/locations', {
    method: 'POST',
    body: { name },
  });
  notifyLocationsChanged();
  return location;
}

export async function updateLocation(id: string, payload: Record<string, string | number>): Promise<void> {
  await apiFetch(`/api/locations/${id}`, {
    method: 'PUT',
    body: payload,
  });
  notifyLocationsChanged();
}

export async function deleteLocation(id: string): Promise<void> {
  await apiFetch(`/api/locations/${id}`, {
    method: 'DELETE',
  });
  notifyLocationsChanged();
}

export async function joinLocation(inviteCode: string): Promise<Location> {
  const location = await apiFetch<Location>('/api/locations/join', {
    method: 'POST',
    body: { inviteCode },
  });
  notifyLocationsChanged();
  return location;
}

export async function leaveLocation(locationId: string, userId: string): Promise<void> {
  await apiFetch(`/api/locations/${locationId}/members/${userId}`, {
    method: 'DELETE',
  });
  notifyLocationsChanged();
}

export async function removeMember(locationId: string, userId: string): Promise<void> {
  await apiFetch(`/api/locations/${locationId}/members/${userId}`, {
    method: 'DELETE',
  });
  notifyLocationsChanged();
}

export async function regenerateInvite(locationId: string): Promise<{ inviteCode: string }> {
  const result = await apiFetch<{ inviteCode: string }>(`/api/locations/${locationId}/regenerate-invite`, {
    method: 'POST',
  });
  notifyLocationsChanged();
  return result;
}

export async function changeMemberRole(locationId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
  await apiFetch(`/api/locations/${locationId}/members/${userId}/role`, {
    method: 'PUT',
    body: { role },
  });
  notifyLocationsChanged();
}
