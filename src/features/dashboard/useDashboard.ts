import { useMemo } from 'react';
import { useAreaList } from '@/features/areas/useAreas';
import { useBinList } from '@/features/bins/useBins';
import { usePinnedBins } from '@/features/pins/usePins';
import { useAuth } from '@/lib/auth';
import { useDashboardSettings } from '@/lib/dashboardSettings';
import type { Bin } from '@/types';
import { useScanHistory } from './scanHistory';

export interface AreaStat {
  id: string | null;
  name: string;
  binCount: number;
}

export function useDashboard() {
  const { activeLocationId } = useAuth();
  const { bins, isLoading } = useBinList();
  const { pinnedBins } = usePinnedBins();
  const { areas } = useAreaList(activeLocationId);
  const { settings: dashSettings } = useDashboardSettings();
  const { history: scanHistory } = useScanHistory(dashSettings.recentBinsCount);

  const totalBins = bins.length;

  const totalItems = useMemo(
    () => bins.reduce((sum, b) => sum + (b.items?.length ?? 0), 0),
    [bins]
  );

  const needsOrganizing = useMemo(
    () =>
      bins.filter(
        (b) =>
          (!Array.isArray(b.tags) || b.tags.length === 0) &&
          !b.area_id &&
          (!Array.isArray(b.items) || b.items.length === 0)
      ).length,
    [bins]
  );

  const totalAreas = areas.length;

  const areaStats = useMemo(() => {
    const countMap = new Map<string | null, number>();
    for (const bin of bins) {
      const key = bin.area_id;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }
    const stats: AreaStat[] = areas.map((a) => ({
      id: a.id,
      name: a.name,
      binCount: countMap.get(a.id) || 0,
    }));
    stats.sort((a, b) => b.binCount - a.binCount);
    const unassigned = countMap.get(null) || 0;
    if (unassigned > 0) {
      stats.push({ id: null, name: 'Unassigned', binCount: unassigned });
    }
    return stats;
  }, [areas, bins]);

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

  return { totalBins, totalItems, totalAreas, needsOrganizing, areaStats, recentlyUpdated, recentlyScanned, pinnedBins, isLoading };
}
