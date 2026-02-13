import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ActivityLogEntry, ListResponse } from '@/types';

export function useActivityLog(options?: { entityType?: string; entityId?: string; limit?: number }) {
  const { activeLocationId, token } = useAuth();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = options?.limit ?? 50;

  const fetchActivity = useCallback(async (currentOffset: number) => {
    if (!token || !activeLocationId) {
      setEntries([]);
      setCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let url = `/api/locations/${encodeURIComponent(activeLocationId)}/activity?limit=${limit}&offset=${currentOffset}`;
      if (options?.entityType) url += `&entity_type=${encodeURIComponent(options.entityType)}`;
      if (options?.entityId) url += `&entity_id=${encodeURIComponent(options.entityId)}`;

      const data = await apiFetch<ListResponse<ActivityLogEntry>>(url);
      if (currentOffset === 0) {
        setEntries(data.results);
      } else {
        setEntries((prev) => [...prev, ...data.results]);
      }
      setCount(data.count);
    } catch {
      if (currentOffset === 0) {
        setEntries([]);
        setCount(0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, activeLocationId, limit, options?.entityType, options?.entityId]);

  useEffect(() => {
    setOffset(0);
    fetchActivity(0);
  }, [fetchActivity]);

  const loadMore = useCallback(() => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    fetchActivity(newOffset);
  }, [offset, limit, fetchActivity]);

  const hasMore = entries.length < count;

  return { entries, count, isLoading, hasMore, loadMore };
}
