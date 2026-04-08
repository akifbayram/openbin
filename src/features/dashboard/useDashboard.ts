import { useEffect, useMemo, useState } from 'react';
import { useAreaList } from '@/features/areas/useAreas';
import { useBinList } from '@/features/bins/useBins';
import { useLocationCheckouts } from '@/features/checkouts/useCheckouts';
import { usePinnedBins } from '@/features/pins/usePins';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDashboardSettings } from '@/lib/dashboardSettings';
import { Events, useRefreshOn } from '@/lib/eventBus';
import type { Bin } from '@/types';
import { useScanHistory } from './scanHistory';

interface DashboardStats {
  total_bins: number;
  total_items: number;
  total_areas: number;
  needs_organizing: number;
}

function useDashboardStats(locationId: string | null) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshKey = useRefreshOn(Events.BINS, Events.AREAS);

  useEffect(() => {
    if (!locationId) {
      setStats(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    apiFetch<DashboardStats>(`/api/locations/${locationId}/stats`)
      .then((data) => { if (!cancelled) { setStats(data); setIsLoading(false); } })
      .catch(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [locationId, refreshKey]);

  return { stats, isLoading };
}

export function useDashboard() {
  const { activeLocationId } = useAuth();
  const { bins, isLoading: binsLoading } = useBinList();
  const { pinnedBins } = usePinnedBins();
  const { areas } = useAreaList(activeLocationId);
  const { settings: dashSettings } = useDashboardSettings();
  const { history: scanHistory } = useScanHistory(dashSettings.recentBinsCount);
  const { stats, isLoading: statsLoading } = useDashboardStats(activeLocationId);
  const { checkouts, isLoading: checkoutsLoading } = useLocationCheckouts(activeLocationId ?? undefined);

  // Client-side fallbacks (used until server stats arrive)
  const clientTotalItems = useMemo(
    () => bins.reduce((sum, b) => sum + (b.items?.length ?? 0), 0),
    [bins],
  );
  const clientNeedsOrganizing = useMemo(
    () =>
      bins.filter(
        (b) =>
          (!Array.isArray(b.tags) || b.tags.length === 0) &&
          !b.area_id &&
          (!Array.isArray(b.items) || b.items.length === 0)
      ).length,
    [bins],
  );

  // Use server stats when available, fall back to client-computed
  const totalBins = stats?.total_bins ?? bins.length;
  const totalItems = stats?.total_items ?? clientTotalItems;
  const totalAreas = stats?.total_areas ?? areas.length;
  const needsOrganizing = stats?.needs_organizing ?? clientNeedsOrganizing;

  const recentlyUpdated = useMemo(
    () =>
      [...bins]
        .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
        .slice(0, dashSettings.recentBinsCount),
    [bins, dashSettings.recentBinsCount]
  );

  const recentlyScanned = useMemo(() => {
    const binMap = new Map(bins.map((b) => [b.id, b]));
    return scanHistory
      .map((e) => binMap.get(e.binId))
      .filter((b): b is Bin => b != null)
      .slice(0, dashSettings.recentBinsCount);
  }, [bins, scanHistory, dashSettings.recentBinsCount]);

  // Map binId → scannedAt for display
  const scanTimeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of scanHistory) map.set(entry.binId, entry.scannedAt);
    return map;
  }, [scanHistory]);

  const isLoading = binsLoading || statsLoading || checkoutsLoading;

  return { totalBins, totalItems, totalAreas, needsOrganizing, checkoutCount: checkouts.length, recentlyUpdated, recentlyScanned, scanTimeMap, pinnedBins, isLoading };
}
