import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useBinList } from '@/features/bins/useBins';
import { useAreaList } from '@/features/areas/useAreas';
import { getScanHistory } from './scanHistory';
import type { Bin } from '@/types';

export interface AreaStat {
  id: string | null;
  name: string;
  binCount: number;
}

export function useDashboard() {
  const { user, activeLocationId } = useAuth();
  const { bins, isLoading } = useBinList();
  const { areas } = useAreaList(activeLocationId);

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
        .slice(0, 5),
    [bins]
  );

  const recentlyScanned = useMemo(() => {
    if (!user) return [] as Bin[];
    const history = getScanHistory(user.id);
    const binMap = new Map(bins.map((b) => [b.id, b]));
    return history
      .map((e) => binMap.get(e.binId))
      .filter((b): b is Bin => b != null)
      .slice(0, 5);
  }, [bins, user]);

  return { totalBins, totalItems, totalAreas, needsOrganizing, areaStats, recentlyUpdated, recentlyScanned, isLoading };
}
