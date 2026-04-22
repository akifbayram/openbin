import { useLocation, useNavigate } from 'react-router-dom';
import { useEntitySelectionInteraction } from '@/lib/bulk/useEntitySelectionInteraction';
import { useTerminology } from '@/lib/terminology';
import type { BinFilters, SortOption } from './useBins';

interface UseBinCardInteractionOptions {
  binId: string;
  index: number;
  selectable?: boolean;
  onSelect?: (id: string, index: number, shiftKey: boolean) => void;
  searchQuery?: string;
  sort?: SortOption;
  filters?: BinFilters;
}

export function useBinCardInteraction({ binId, index, selectable, onSelect, searchQuery, sort, filters }: UseBinCardInteractionOptions) {
  const navigate = useNavigate();
  const loc = useLocation();
  const t = useTerminology();
  const backPath = loc.pathname + loc.search;
  const backLabel = loc.pathname === '/' ? 'Home' : t.Bins;
  const navState = { backLabel, backPath, searchQuery, sort, filters };

  return useEntitySelectionInteraction({
    id: binId,
    index,
    selectable,
    onSelect,
    onActivate: () => navigate(`/bin/${binId}`, { state: navState }),
  });
}
