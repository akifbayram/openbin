import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { CatalogPlan, PlanCatalog } from '@/types';

interface CacheEntry {
  promise: Promise<PlanCatalog>;
  data: PlanCatalog | null;
  error: Error | null;
}

let cache: CacheEntry | null = null;

export function __resetPlanCatalogCache(): void {
  cache = null;
}

function fetchCatalog(): CacheEntry {
  if (cache) return cache;
  const entry: CacheEntry = {
    promise: apiFetch<PlanCatalog>('/api/plans'),
    data: null,
    error: null,
  };
  entry.promise
    .then(data => { entry.data = data; })
    .catch(err => { entry.error = err instanceof Error ? err : new Error(String(err)); });
  cache = entry;
  return entry;
}

interface UsePlanCatalogResult {
  plans: CatalogPlan[];
  isLoading: boolean;
  error: Error | null;
}

export function usePlanCatalog(): UsePlanCatalogResult {
  const [, setTick] = useState(0);
  const entry = fetchCatalog();

  useEffect(() => {
    if (entry.data || entry.error) return;
    let cancelled = false;
    // Re-render once the cache entry settles. Swallow the rejection here —
    // it's already captured on `entry.error` by the `.catch` handler in
    // `fetchCatalog`. Without this swallow, `.finally()` would re-throw
    // and trigger an unhandled-rejection warning under happy-dom.
    entry.promise
      .finally(() => {
        if (!cancelled) setTick(t => t + 1);
      })
      .catch(() => {
        // already handled in fetchCatalog
      });
    return () => { cancelled = true; };
  }, [entry]);

  return {
    plans: entry.data?.plans ?? [],
    isLoading: !entry.data && !entry.error,
    error: entry.error,
  };
}
