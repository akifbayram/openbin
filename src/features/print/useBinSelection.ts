import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Bin } from '@/types';

export function useBinSelection(allBins: Bin[]) {
  const [searchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      setSelectedIds(new Set(idsParam.split(',')));
    }
  }, [searchParams]);

  const selectedBins = useMemo(() => allBins.filter((b) => selectedIds.has(b.id)), [allBins, selectedIds]);

  function toggleBin(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(allBins.map((b) => b.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  function toggleArea(areaId: string | null) {
    const areaIds = allBins.filter((b) => b.area_id === areaId).map((b) => b.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (areaIds.every((id) => prev.has(id))) {
        for (const id of areaIds) next.delete(id);
      } else {
        for (const id of areaIds) next.add(id);
      }
      return next;
    });
  }

  return { selectedIds, selectedBins, toggleBin, selectAll, selectNone, toggleArea };
}
