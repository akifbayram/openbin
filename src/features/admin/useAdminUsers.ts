import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  isAdmin: boolean;
  plan: 'lite' | 'pro';
  status: 'active' | 'inactive' | 'trial';
  activeUntil: string | null;
  deletedAt: string | null;
  createdAt: string;
  binCount: number;
  locationCount: number;
  photoStorageMb: number;
}

interface RegistrationInfo {
  mode: 'open' | 'invite' | 'closed';
  locked: boolean;
}

export function useAdminUsers(query = '', page = 1, sort = '-created') {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [count, setCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [registration, setRegistration] = useState<RegistrationInfo>({ mode: 'open', locked: false });

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('page', String(page));
      params.set('sort', sort);
      const qs = params.toString();
      const data = await apiFetch<{ results: AdminUser[]; count: number; adminCount: number }>(`/api/admin/users?${qs}`);
      setUsers(data.results);
      setCount(data.count);
      setAdminCount(data.adminCount);
    } catch {
      setUsers([]);
      setCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [query, page, sort]);

  const fetchRegistration = useCallback(async () => {
    try {
      const data = await apiFetch<RegistrationInfo>('/api/admin/registration');
      setRegistration(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchRegistration(); }, [fetchRegistration]);

  const handleUpdateUser = useCallback(async (id: string, updates: { isAdmin?: boolean; subStatus?: number }) => {
    await updateUser(id, updates);
    await fetchUsers();
  }, [fetchUsers]);

  const handleDeleteUser = useCallback(async (id: string) => {
    await deleteUser(id);
    await fetchUsers();
  }, [fetchUsers]);

  const updateRegistrationMode = useCallback(async (mode: 'open' | 'invite' | 'closed') => {
    await apiFetch('/api/admin/registration', { method: 'PATCH', body: { mode } });
    setRegistration((prev) => ({ ...prev, mode }));
  }, []);

  const createUser = useCallback(async (data: {
    username: string; password: string; displayName?: string; email?: string; isAdmin?: boolean;
  }) => {
    const result = await apiFetch<AdminUser>('/api/admin/users', { method: 'POST', body: data });
    await fetchUsers();
    return result;
  }, [fetchUsers]);

  return { users, count, adminCount, isLoading, registration, updateUser: handleUpdateUser, deleteUser: handleDeleteUser, updateRegistrationMode, createUser, refresh: fetchUsers };
}

export interface AdminUserDetail {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  isAdmin: boolean;
  plan: 'lite' | 'pro';
  status: 'active' | 'inactive' | 'trial';
  activeUntil: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    locationCount: number;
    binCount: number;
    photoCount: number;
    photoStorageMb: number;
    apiKeyCount: number;
    shareCount: number;
  };
}

export async function fetchUser(id: string): Promise<AdminUserDetail> {
  return apiFetch<AdminUserDetail>(`/api/admin/users/${id}`);
}

export async function updateUser(id: string, updates: { isAdmin?: boolean; subStatus?: number; plan?: number; email?: string; displayName?: string; password?: string; activeUntil?: string | null }) {
  await apiFetch(`/api/admin/users/${id}`, { method: 'PUT', body: updates });
}

export async function deleteUser(id: string) {
  await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
}

export async function regenerateApiKey(id: string) {
  return apiFetch<{ keyPrefix: string; name: string; createdAt: string }>(`/api/admin/users/${id}/regenerate-api-key`, { method: 'POST' });
}

export async function sendPasswordReset(id: string) {
  return apiFetch<{ message: string }>(`/api/admin/users/${id}/send-password-reset`, { method: 'POST' });
}

export async function fetchAdminCount(): Promise<number> {
  const data = await apiFetch<{ results: AdminUser[]; count: number; adminCount: number }>('/api/admin/users?page=1');
  return data.adminCount;
}

export function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'trial') return 'outline';
  return 'secondary';
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function useAdminCount() {
  const [adminCount, setAdminCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    fetchAdminCount().then(setAdminCount).catch(() => {});
  }, []);

  useEffect(() => {
    fetchAdminCount()
      .then(setAdminCount)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return { adminCount, isLoading, refresh };
}

export function useAdminUserDetail(id: string) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setNotFound(false);
    fetchUser(id)
      .then(setDetail)
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [id]);

  const refresh = useCallback(() => {
    if (!id) return;
    fetchUser(id).then(setDetail).catch(() => {});
  }, [id]);

  return { detail, isLoading, notFound, refresh };
}
