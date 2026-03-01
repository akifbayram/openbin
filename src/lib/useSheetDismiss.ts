import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSheetDismissOptions {
  onDismiss: () => void;
  enabled: boolean;
}

interface UseSheetDismissReturn {
  panelRef: React.RefObject<HTMLDivElement>;
  scrollRef: React.RefObject<HTMLDivElement>;
  handleRef: React.RefObject<HTMLDivElement>;
  translateY: number;
  isDragging: boolean;
  isDismissing: boolean;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

const DRAG_THRESHOLD = 10;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.5;
const RESISTANCE = 0.55;

const SNAP_TRANSITION = 'transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1)';
const DISMISS_TRANSITION = 'transform 0.3s cubic-bezier(0.4, 0, 1, 1)';

export function useSheetDismiss({ onDismiss, enabled }: UseSheetDismissOptions): UseSheetDismissReturn {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  // Mutable tracking state (avoids re-renders during gesture)
  const startY = useRef(0);
  const startTime = useRef(0);
  const touchedHandle = useRef(false);
  // null = undecided, 'drag' | 'scroll'
  const decision = useRef<'drag' | 'scroll' | null>(null);

  // Reset all state when disabled (dialog closed)
  useEffect(() => {
    if (!enabled) {
      setTranslateY(0);
      setIsDragging(false);
      setIsDismissing(false);
      decision.current = null;
    }
  }, [enabled]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || e.touches.length > 1) return;
    const touch = e.touches[0];
    startY.current = touch.clientY;
    startTime.current = Date.now();
    decision.current = null;
    touchedHandle.current = handleRef.current?.contains(touch.target as Node) ?? false;
  }, [enabled]);

  // Native touchmove listener with { passive: false } so preventDefault works
  useEffect(() => {
    const panel = panelRef.current;
    if (!enabled || !panel) return;

    function onTouchMove(e: TouchEvent) {
      // Multi-touch → abort drag, snap back
      if (e.touches.length > 1) {
        if (decision.current === 'drag') {
          decision.current = null;
          setIsDragging(false);
          setTranslateY(0);
        }
        return;
      }

      const deltaY = e.touches[0].clientY - startY.current;

      // Haven't committed to a direction yet
      if (decision.current === null) {
        if (Math.abs(deltaY) < DRAG_THRESHOLD) return;

        const scrollTop = scrollRef.current?.scrollTop ?? 0;
        if (deltaY > 0 && (scrollTop <= 0 || touchedHandle.current)) {
          decision.current = 'drag';
          setIsDragging(true);
        } else {
          decision.current = 'scroll';
          return;
        }
      }

      if (decision.current === 'scroll') return;

      // Prevent native scroll while dragging
      e.preventDefault();

      const dampened = Math.max(0, deltaY) * RESISTANCE;
      setTranslateY(dampened);
    }

    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => panel.removeEventListener('touchmove', onTouchMove);
  }, [enabled]);

  const onTouchEnd = useCallback(() => {
    if (!enabled || decision.current !== 'drag') {
      decision.current = null;
      return;
    }

    const elapsed = Date.now() - startTime.current;
    const velocity = translateY / Math.max(elapsed, 1);
    const shouldDismiss = translateY > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (shouldDismiss) {
      if (prefersReduced) {
        setTranslateY(0);
        setIsDragging(false);
        decision.current = null;
        onDismiss();
      } else {
        setIsDismissing(true);
        setIsDragging(false);
        // Slide fully off screen
        setTranslateY(window.innerHeight);
        // Wait for transition to finish
        const panel = panelRef.current;
        if (panel) {
          const handler = () => {
            panel.removeEventListener('transitionend', handler);
            setIsDismissing(false);
            setTranslateY(0);
            decision.current = null;
            onDismiss();
          };
          panel.addEventListener('transitionend', handler, { once: true });
          // Fallback in case transitionend doesn't fire
          setTimeout(handler, 350);
        } else {
          decision.current = null;
          onDismiss();
        }
      }
    } else {
      // Snap back
      setTranslateY(0);
      setIsDragging(false);
      decision.current = null;
    }
  }, [enabled, translateY, onDismiss]);

  return {
    panelRef,
    scrollRef,
    handleRef,
    translateY,
    isDragging,
    isDismissing,
    handlers: { onTouchStart, onTouchEnd },
  };
}

export function getSheetPanelStyle(
  translateY: number,
  isDragging: boolean,
  isDismissing: boolean,
): React.CSSProperties | undefined {
  if (translateY === 0 && !isDragging && !isDismissing) return undefined;
  return {
    transform: `translateY(${translateY}px)`,
    transition: isDragging ? 'none' : isDismissing ? DISMISS_TRANSITION : SNAP_TRANSITION,
    willChange: 'transform',
  };
}

export function getSheetBackdropStyle(
  translateY: number,
  isDragging: boolean,
  isDismissing: boolean,
): React.CSSProperties | undefined {
  if (translateY === 0 && !isDragging && !isDismissing) return undefined;
  return {
    opacity: Math.max(0.2, 1 - translateY / 400),
    transition: isDragging ? 'none' : isDismissing ? DISMISS_TRANSITION : SNAP_TRANSITION,
  };
}
