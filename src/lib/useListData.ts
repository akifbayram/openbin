import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { EventName } from '@/lib/eventBus';
import { notify, useRefreshOn } from '@/lib/eventBus';
import { getErrorMessage } from '@/lib/utils';
import type { ListResponse } from '@/types';

/**
 * Generic hook for the common list-fetch pattern:
 * fetch from API path, extract results, listen for refresh events.
 *
 * @param path  API path to fetch, or null to skip fetching (acts as guard).
 * @param events  Event names that trigger a refetch.
 * @param transform  Optional transform applied to `response.results`.
 */
export function useListData<T, R = T>(
  path: string | null,
  events: EventName[],
  transform?: (results: R[]) => T[],
): { data: T[]; isLoading: boolean; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);
  const refreshCounter = useRefreshOn(...events);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshCounter is an intentional trigger dep; transform is caller-provided and intentionally excluded to avoid refetch loops
  useEffect(() => {
    if (!path) {
      setData([]);
      setIsLoading(false);
      setError(null);
      hasData.current = false;
      return;
    }

    let cancelled = false;
    // Only show loading skeleton on initial load, not background refreshes
    if (!hasData.current) setIsLoading(true);
    setError(null);

    apiFetch<ListResponse<R>>(path)
      .then((resp) => {
        if (!cancelled) {
          setData(transform ? transform(resp.results) : resp.results as unknown as T[]);
          hasData.current = true;
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setData([]);
          setError(getErrorMessage(err, 'Failed to load'));
          hasData.current = false;
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [path, refreshCounter]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: join(',') is a stable proxy for the events array reference
  const refresh = useCallback(() => {
    for (const e of events) notify(e);
  }, [events.join(',')]);

  return { data, isLoading, error, refresh };
}
