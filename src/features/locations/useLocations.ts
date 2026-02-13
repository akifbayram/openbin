import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Location, LocationMember, ListResponse } from '@/types';

const LOCATIONS_CHANGED_EVENT = 'locations-changed';

/** Notify all useLocationList instances to refetch */
function notifyLocationsChanged() {
  window.dispatchEvent(new Event(LOCATIONS_CHANGED_EVENT));
}

export function useLocationList() {
  const { token } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!token) {
      setLocations([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<ListResponse<Location>>('/api/locations')
      .then((data) => {
        if (!cancelled) setLocations(data.results);
      })
      .catch(() => {
        if (!cancelled) setLocations([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, refreshCounter]);

  // Listen for locations-changed events from create/join/delete actions
  useEffect(() => {
    const handler = () => setRefreshCounter((c) => c + 1);
    window.addEventListener(LOCATIONS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(LOCATIONS_CHANGED_EVENT, handler);
  }, []);

  const refresh = useCallback(() => setRefreshCounter((c) => c + 1), []);

  return { locations, isLoading, refresh };
}

export function useLocationMembers(locationId: string | null) {
  const { token } = useAuth();
  const [members, setMembers] = useState<LocationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!locationId || !token) {
      setMembers([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<ListResponse<LocationMember>>(`/api/locations/${locationId}/members`)
      .then((data) => {
        if (!cancelled) setMembers(data.results);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [locationId, token, refreshCounter]);

  useEffect(() => {
    const handler = () => setRefreshCounter((c) => c + 1);
    window.addEventListener(LOCATIONS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(LOCATIONS_CHANGED_EVENT, handler);
  }, []);

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

export async function updateLocation(id: string, name: string): Promise<void> {
  await apiFetch(`/api/locations/${id}`, {
    method: 'PUT',
    body: { name },
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
