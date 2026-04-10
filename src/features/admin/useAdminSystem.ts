import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetName: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  text: string;
  type: 'info' | 'warning' | 'critical';
  dismissible: boolean;
  active: boolean;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface SystemHealth {
  dbSizeBytes: number;
  userCount: { total: number; active: number; deleted: number; suspended: number };
  activeSessions: number;
  uptime: number;
}

export interface AdminLocation {
  id: string;
  name: string;
  ownerUsername: string;
  ownerDisplayName: string;
  memberCount: number;
  binCount: number;
  areaCount: number;
  createdAt: string;
}

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
}

export function useAuditLog(page = 1, filters: { action?: string; actorId?: string; targetType?: string } = {}) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (filters.action) params.set('action', filters.action);
      if (filters.actorId) params.set('actor_id', filters.actorId);
      if (filters.targetType) params.set('target_type', filters.targetType);
      const data = await apiFetch<{ results: AuditLogEntry[]; count: number }>(`/api/admin/system/audit-log?${params}`);
      setEntries(data.results);
      setCount(data.count);
    } catch {
      setEntries([]);
      setCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, filters.action, filters.actorId, filters.targetType]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  return { entries, count, isLoading, refresh: fetchEntries };
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ results: Announcement[]; count: number }>('/api/admin/system/announcements');
      setAnnouncements(data.results);
    } catch {
      setAnnouncements([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const createAnnouncement = useCallback(async (body: { text: string; type?: string; dismissible?: boolean; expiresAt?: string }) => {
    await apiFetch('/api/admin/system/announcements', { method: 'POST', body });
    await fetchAnnouncements();
  }, [fetchAnnouncements]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    await apiFetch(`/api/admin/system/announcements/${id}`, { method: 'DELETE' });
    await fetchAnnouncements();
  }, [fetchAnnouncements]);

  return { announcements, isLoading, createAnnouncement, deleteAnnouncement, refresh: fetchAnnouncements };
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  return apiFetch<SystemHealth>('/api/admin/system/health');
}

export async function fetchMaintenanceStatus(): Promise<MaintenanceStatus> {
  return apiFetch<MaintenanceStatus>('/api/admin/system/maintenance');
}

export async function toggleMaintenance(enabled: boolean, message?: string) {
  return apiFetch<MaintenanceStatus>('/api/admin/system/maintenance', { method: 'POST', body: { enabled, message } });
}

export function useAdminLocations(query = '', page = 1) {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('page', String(page));
      const data = await apiFetch<{ results: AdminLocation[]; count: number }>(`/api/admin/system/locations?${params}`);
      setLocations(data.results);
      setCount(data.count);
    } catch {
      setLocations([]);
      setCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [query, page]);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  return { locations, count, isLoading, refresh: fetchLocations };
}

export async function forceJoinLocation(locationId: string, userId: string, role: string) {
  await apiFetch(`/api/admin/system/locations/${locationId}/force-join`, { method: 'POST', body: { userId, role } });
}

export async function removeLocationMember(locationId: string, userId: string) {
  await apiFetch(`/api/admin/system/locations/${locationId}/members/${userId}`, { method: 'DELETE' });
}

export async function changeLocationMemberRole(locationId: string, userId: string, role: string) {
  await apiFetch(`/api/admin/system/locations/${locationId}/members/${userId}/role`, { method: 'PUT', body: { role } });
}
