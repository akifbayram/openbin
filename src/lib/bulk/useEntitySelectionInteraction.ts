import { useCallback } from 'react';
import { useLongPress } from '@/lib/useLongPress';
import { haptic } from '@/lib/utils';

export interface UseEntitySelectionInteractionOptions {
  id: string;
  index: number;
  selectable?: boolean;
  onSelect?: (id: string, index: number, shiftKey: boolean) => void;
  /** Called on click/Enter when NOT in selection mode. */
  onActivate: () => void;
}

export function useEntitySelectionInteraction(opts: UseEntitySelectionInteractionOptions) {
  const { id, index, selectable, onSelect, onActivate } = opts;

  const handleLongPress = useCallback(() => {
    if (!selectable) {
      haptic();
      onSelect?.(id, index, false);
    }
  }, [selectable, onSelect, id, index]);

  const { onTouchStart, onTouchEnd, onTouchMove, onContextMenu, didLongPress } = useLongPress(handleLongPress);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (didLongPress.current) return;
      if (selectable) {
        onSelect?.(id, index, e.shiftKey);
      } else {
        onActivate();
      }
    },
    [didLongPress, selectable, onSelect, onActivate, id, index],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (selectable) {
        onSelect?.(id, index, false);
      } else {
        onActivate();
      }
    },
    [selectable, onSelect, onActivate, id, index],
  );

  return {
    handleClick,
    handleKeyDown,
    longPress: { onTouchStart, onTouchEnd, onTouchMove, onContextMenu },
    didLongPress,
  };
}
