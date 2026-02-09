import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Home, HomeMember } from '@/types';

const HOMES_CHANGED_EVENT = 'homes-changed';

/** Notify all useHomeList instances to refetch */
function notifyHomesChanged() {
  window.dispatchEvent(new Event(HOMES_CHANGED_EVENT));
}

export function useHomeList() {
  const { token } = useAuth();
  const [homes, setHomes] = useState<Home[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!token) {
      setHomes([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<Home[]>('/api/homes')
      .then((data) => {
        if (!cancelled) setHomes(data);
      })
      .catch(() => {
        if (!cancelled) setHomes([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, refreshCounter]);

  // Listen for homes-changed events from create/join/delete actions
  useEffect(() => {
    const handler = () => setRefreshCounter((c) => c + 1);
    window.addEventListener(HOMES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(HOMES_CHANGED_EVENT, handler);
  }, []);

  const refresh = useCallback(() => setRefreshCounter((c) => c + 1), []);

  return { homes, isLoading, refresh };
}

export function useHomeMembers(homeId: string | null) {
  const { token } = useAuth();
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!homeId || !token) {
      setMembers([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<HomeMember[]>(`/api/homes/${homeId}/members`)
      .then((data) => {
        if (!cancelled) setMembers(data);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [homeId, token, refreshCounter]);

  useEffect(() => {
    const handler = () => setRefreshCounter((c) => c + 1);
    window.addEventListener(HOMES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(HOMES_CHANGED_EVENT, handler);
  }, []);

  return { members, isLoading };
}

export async function createHome(name: string): Promise<Home> {
  const home = await apiFetch<Home>('/api/homes', {
    method: 'POST',
    body: { name },
  });
  notifyHomesChanged();
  return home;
}

export async function updateHome(id: string, name: string): Promise<void> {
  await apiFetch(`/api/homes/${id}`, {
    method: 'PUT',
    body: { name },
  });
  notifyHomesChanged();
}

export async function deleteHome(id: string): Promise<void> {
  await apiFetch(`/api/homes/${id}`, {
    method: 'DELETE',
  });
  notifyHomesChanged();
}

export async function joinHome(inviteCode: string): Promise<Home> {
  const home = await apiFetch<Home>('/api/homes/join', {
    method: 'POST',
    body: { inviteCode },
  });
  notifyHomesChanged();
  return home;
}

export async function leaveHome(homeId: string, userId: string): Promise<void> {
  await apiFetch(`/api/homes/${homeId}/members/${userId}`, {
    method: 'DELETE',
  });
  notifyHomesChanged();
}

export async function removeMember(homeId: string, userId: string): Promise<void> {
  await apiFetch(`/api/homes/${homeId}/members/${userId}`, {
    method: 'DELETE',
  });
  notifyHomesChanged();
}

export async function regenerateInvite(homeId: string): Promise<{ inviteCode: string }> {
  const result = await apiFetch<{ inviteCode: string }>(`/api/homes/${homeId}/regenerate-invite`, {
    method: 'POST',
  });
  notifyHomesChanged();
  return result;
}
