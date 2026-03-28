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
  createdAt: string;
}

interface RegistrationInfo {
  mode: 'open' | 'invite' | 'closed';
  locked: boolean;
}

export function useAdminUsers(query = '', page = 1) {
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
  }, [query, page]);

  const fetchRegistration = useCallback(async () => {
    try {
      const data = await apiFetch<RegistrationInfo>('/api/admin/registration');
      setRegistration(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchRegistration(); }, [fetchRegistration]);

  const updateUser = useCallback(async (id: string, updates: { isAdmin?: boolean; subStatus?: number }) => {
    await apiFetch(`/api/admin/users/${id}`, { method: 'PUT', body: updates });
    await fetchUsers();
  }, [fetchUsers]);

  const deleteUser = useCallback(async (id: string) => {
    await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    await fetchUsers();
  }, [fetchUsers]);

  const updateRegistrationMode = useCallback(async (mode: 'open' | 'invite' | 'closed') => {
    await apiFetch('/api/admin/registration', { method: 'PATCH', body: { mode } });
    setRegistration((prev) => ({ ...prev, mode }));
  }, []);

  return { users, count, adminCount, isLoading, registration, updateUser, deleteUser, updateRegistrationMode, refresh: fetchUsers };
}
