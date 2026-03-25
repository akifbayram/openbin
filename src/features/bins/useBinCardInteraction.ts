import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTerminology } from '@/lib/terminology';
import { useLongPress } from '@/lib/useLongPress';
import { haptic } from '@/lib/utils';
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

  const handleLongPress = useCallback(() => {
    if (!selectable) {
      haptic();
      onSelect?.(binId, index, false);
    }
  }, [selectable, onSelect, binId, index]);

  const { onTouchStart, onTouchEnd, onTouchMove, onContextMenu, didLongPress } = useLongPress(handleLongPress);

  function handleClick(e: React.MouseEvent) {
    if (didLongPress.current) return;
    if (selectable) {
      onSelect?.(binId, index, e.shiftKey);
    } else {
      navigate(`/bin/${binId}`, { state: navState });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (selectable) {
        onSelect?.(binId, index, false);
      } else {
        navigate(`/bin/${binId}`, { state: navState });
      }
    }
  }

  return {
    handleClick,
    handleKeyDown,
    longPress: { onTouchStart, onTouchEnd, onTouchMove, onContextMenu },
    didLongPress,
  };
}
