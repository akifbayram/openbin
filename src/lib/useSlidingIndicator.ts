import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { observeResize } from './sharedResizeObserver';

interface Indicator {
  left: number;
  width: number;
}

export function useSlidingIndicator(activeKey: string | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLElement>());
  const [hasMounted, setHasMounted] = useState(false);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [indicator, setIndicator] = useState<Indicator | null>(null);

  const setButtonRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) buttonRefs.current.set(key, el);
      else buttonRefs.current.delete(key);
    },
    [],
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!activeKey || !container) {
      setIndicator((prev) => (prev === null ? prev : null));
      return;
    }
    const btn = buttonRefs.current.get(activeKey);
    if (!btn) return;
    const cr = container.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const left = br.left - cr.left;
    const width = br.width;
    setIndicator((prev) =>
      prev && prev.left === left && prev.width === width ? prev : { left, width },
    );
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();
    if (!hasMounted) {
      requestAnimationFrame(() => setHasMounted(true));
    }
  }, [measure, hasMounted]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    return observeResize(container, measure);
  }, [measure]);

  const animate = hasMounted && !prefersReducedMotion.current;

  return { containerRef, setButtonRef, indicator, animate };
}
