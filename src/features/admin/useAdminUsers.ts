import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface AdminUser {
  id: string;
  displayName: string;
  email: string | null;
  isAdmin: boolean;
  plan: 'free' | 'plus' | 'pro';
  status: 'active' | 'inactive' | 'trial';
  activeUntil: string | null;
  suspendedAt: string | null;
  deletedAt: string | null;
  deletionScheduledAt?: string | null;
  createdAt: string;
  binCount: number;
  locationCount: number;
  photoStorageMb: number;
  lastActiveAt: string | null;
  itemCount: number;
  photoCount: number;
  scans30d: number;
  aiCreditsUsed: number;
  aiCreditsLimit: number;
  apiKeyCount: number;
  apiRequests7d: number;
  binsCreated7d: number;
  binLimit: number | null;
  storageLimit: number | null;
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
    email: string; password: string; displayName?: string; isAdmin?: boolean;
  }) => {
    const result = await apiFetch<AdminUser>('/api/admin/users', { method: 'POST', body: data });
    await fetchUsers();
    return result;
  }, [fetchUsers]);

  return { users, count, adminCount, isLoading, registration, updateUser: handleUpdateUser, deleteUser: handleDeleteUser, updateRegistrationMode, createUser, refresh: fetchUsers };
}

export interface AdminUserDetail {
  id: string;
  displayName: string;
  email: string | null;
  isAdmin: boolean;
  plan: 'free' | 'plus' | 'pro';
  status: 'active' | 'inactive' | 'trial';
  activeUntil: string | null;
  suspendedAt: string | null;
  deletedAt: string | null;
  deletionScheduledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
  stats: {
    locationCount: number;
    binCount: number;
    photoCount: number;
    photoStorageMb: number;
    apiKeyCount: number;
    shareCount: number;
    itemCount: number;
    scans30d: number;
    aiCreditsUsed: number;
    aiCreditsLimit: number;
    aiCreditsResetAt: string | null;
    apiRequests7d: number;
    binsCreated7d: number;
    binLimit: number | null;
    storageLimit: number | null;
    forcePasswordChange: boolean;
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

export async function recoverUser(id: string) {
  await apiFetch(`/api/admin/users/${id}/recover-deletion`, { method: 'POST' });
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

export interface LoginHistoryEntry {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  method: string;
  success: boolean;
  createdAt: string;
}

export async function suspendUser(id: string, reason?: string) {
  await apiFetch(`/api/admin/security/suspend/${id}`, { method: 'POST', body: { reason } });
}

export async function reactivateUser(id: string) {
  await apiFetch(`/api/admin/security/reactivate/${id}`, { method: 'POST' });
}

export async function revokeSessions(id: string) {
  await apiFetch(`/api/admin/security/revoke-sessions/${id}`, { method: 'POST' });
}

export async function revokeAllApiKeys(id: string) {
  return apiFetch<{ message: string; count: number }>(`/api/admin/security/revoke-all-api-keys/${id}`, { method: 'POST' });
}

export async function fetchLoginHistory(id: string, page = 1, limit = 50) {
  return apiFetch<{ results: LoginHistoryEntry[]; count: number }>(`/api/admin/security/login-history/${id}?page=${page}&limit=${limit}`);
}

export async function forcePasswordChange(userId: string, enabled = true) {
  await apiFetch(`/api/admin/security/force-password-change/${userId}`, { method: 'POST', body: { enabled } });
}

export async function forceLogoutAll() {
  await apiFetch('/api/admin/security/force-logout-all', { method: 'POST' });
}

export async function regenInviteCode(locationId: string) {
  return apiFetch<{ inviteCode: string }>(`/api/admin/system/locations/${locationId}/regen-invite`, { method: 'POST' });
}
