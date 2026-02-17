import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { notify, useRefreshOn } from '@/lib/eventBus';
import type { EventName } from '@/lib/eventBus';
import type { ListResponse } from '@/types';

/**
 * Generic hook for the common list-fetch pattern:
 * fetch from API path, extract results, listen for refresh events.
 *
 * @param path  API path to fetch, or null to skip fetching (acts as guard).
 * @param events  Event names that trigger a refetch.
 * @param transform  Optional transform applied to `response.results`.
 */
export function useListData<T>(
  path: string | null,
  events: EventName[],
  transform?: (results: any[]) => T[],
): { data: T[]; isLoading: boolean; refresh: () => void } {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const refreshCounter = useRefreshOn(...events);

  useEffect(() => {
    if (!path) {
      setData([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<ListResponse<any>>(path)
      .then((resp) => {
        if (!cancelled) {
          setData(transform ? transform(resp.results) : resp.results);
        }
      })
      .catch(() => {
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [path, refreshCounter]);

  const refresh = useCallback(() => {
    for (const e of events) notify(e);
  }, [events.join(',')]);

  return { data, isLoading, refresh };
}
