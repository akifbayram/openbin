import { useRef, useCallback } from 'react';

interface LongPressHandlers {
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  /** True if the long press fired — use to suppress the subsequent click. */
  didLongPress: React.RefObject<boolean>;
}

export function useLongPress(onLongPress: () => void, delay = 500): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didFire = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onTouchStart = useCallback(() => {
    didFire.current = false;
    timer.current = setTimeout(() => {
      didFire.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onLongPress();
    },
    [onLongPress],
  );

  return {
    onTouchStart,
    onTouchEnd: clear,
    onTouchMove: clear,
    onContextMenu,
    didLongPress: didFire,
  };
}
