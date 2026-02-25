import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { haptic } from '@/lib/utils';
import { useLongPress } from '@/lib/useLongPress';
import { useTerminology } from '@/lib/terminology';

interface UseBinCardInteractionOptions {
  binId: string;
  index: number;
  selectable?: boolean;
  onSelect?: (id: string, index: number, shiftKey: boolean) => void;
}

export function useBinCardInteraction({ binId, index, selectable, onSelect }: UseBinCardInteractionOptions) {
  const navigate = useNavigate();
  const loc = useLocation();
  const t = useTerminology();
  const backPath = loc.pathname + loc.search;
  const backLabel = loc.pathname === '/' ? 'Home' : t.Bins;

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
      navigate(`/bin/${binId}`, { state: { backLabel, backPath } });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (selectable) {
        onSelect?.(binId, index, false);
      } else {
        navigate(`/bin/${binId}`, { state: { backLabel, backPath } });
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
