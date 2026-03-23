import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserPreferences } from '@/lib/userPreferences';
import {
  filterSteps,
  resolveRoute,
  resolveSelector,
  TOUR_STEPS,
  TOUR_VERSION,
  type TourContext,
  type TourStep,
} from './tourSteps';

/** Poll for a DOM element by selector. Resolves with the element or null on timeout. */
function waitForElement(selector: string, timeoutMs = 3000): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) { resolve(el); return; }
    const start = performance.now();
    function poll() {
      const found = document.querySelector(selector);
      if (found) { resolve(found); return; }
      if (performance.now() - start > timeoutMs) { resolve(null); return; }
      requestAnimationFrame(poll);
    }
    requestAnimationFrame(poll);
  });
}

export interface UseTourDeps {
  context: TourContext;
  navigate: (path: string) => void;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
}

export interface UseTourReturn {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  step: TourStep | null;
  targetRect: DOMRect | null;
  transitioning: boolean;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
}

export function useTour({ context, navigate, updatePreferences }: UseTourDeps): UseTourReturn {
  const [isActive, setIsActive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const filteredRef = useRef<TourStep[]>([]);
  const contextRef = useRef(context);
  contextRef.current = context;

  const observerRef = useRef<ResizeObserver | null>(null);
  const elementRef = useRef<Element | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const navigatingRef = useRef(false);

  // Cleanup rect tracking
  const cleanupTracking = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    elementRef.current = null;
  }, []);

  // rAF-throttled rect update
  const scheduleRectUpdate = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (elementRef.current) {
        setTargetRect(elementRef.current.getBoundingClientRect());
      }
    });
  }, []);

  // Track an element's rect
  const trackElement = useCallback((el: Element) => {
    cleanupTracking();
    elementRef.current = el;
    setTargetRect(el.getBoundingClientRect());

    observerRef.current = new ResizeObserver(scheduleRectUpdate);
    observerRef.current.observe(el);

    window.addEventListener('scroll', scheduleRectUpdate, { capture: true, passive: true });
    window.addEventListener('resize', scheduleRectUpdate, { passive: true });
  }, [cleanupTracking, scheduleRectUpdate]);

  // Cleanup scroll/resize on unmount or step change
  const detachScrollListeners = useCallback(() => {
    window.removeEventListener('scroll', scheduleRectUpdate, true);
    window.removeEventListener('resize', scheduleRectUpdate);
  }, [scheduleRectUpdate]);

  // Navigate to a step and find its element
  const goToStep = useCallback(async (index: number) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    try {
      const steps = filteredRef.current;
      const step = steps[index];
      if (!step) return;

      const ctx = contextRef.current;
      const route = resolveRoute(step, ctx);
      const currentPath = window.location.pathname;

      setTransitioning(true);

      if (currentPath !== route) {
        cleanupTracking();
        detachScrollListeners();
        setTargetRect(null);
        navigate(route);
        await new Promise<void>((r) => setTimeout(r, 150));
      }

      if (step.beforeShow) {
        await step.beforeShow(ctx);
      }

      const selector = resolveSelector(step, ctx);
      const el = await waitForElement(selector);

      if (!el) {
        setTransitioning(false);
        const nextIndex = index + 1;
        if (nextIndex < steps.length) {
          setActiveIndex(nextIndex);
          navigatingRef.current = false;
          goToStep(nextIndex);
          return;
        }
        markComplete();
        return;
      }

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise<void>((r) => setTimeout(r, 300));

      trackElement(el);
      setTransitioning(false);
    } finally {
      navigatingRef.current = false;
    }
  }, [navigate, cleanupTracking, detachScrollListeners, trackElement]);

  const markComplete = useCallback(() => {
    const currentStep = filteredRef.current[activeIndex];
    if (currentStep?.onLeave) {
      currentStep.onLeave(contextRef.current);
    }
    cleanupTracking();
    detachScrollListeners();
    setTargetRect(null);
    setIsActive(false);
    setActiveIndex(0);
    filteredRef.current = [];
    updatePreferences({ tour_completed: true, tour_version: TOUR_VERSION });
  }, [activeIndex, cleanupTracking, detachScrollListeners, updatePreferences]);

  const start = useCallback(() => {
    const filtered = filterSteps(TOUR_STEPS, contextRef.current);
    if (filtered.length === 0) return;
    filteredRef.current = filtered;
    setActiveIndex(0);
    setIsActive(true);
    goToStep(0);
  }, [goToStep]);

  const next = useCallback(() => {
    const steps = filteredRef.current;
    const currentStep = steps[activeIndex];
    if (currentStep?.onLeave) {
      currentStep.onLeave(contextRef.current);
    }

    const nextIndex = activeIndex + 1;
    if (nextIndex >= steps.length) {
      markComplete();
      return;
    }
    setActiveIndex(nextIndex);
    goToStep(nextIndex);
  }, [activeIndex, goToStep, markComplete]);

  const prev = useCallback(() => {
    const steps = filteredRef.current;
    const currentStep = steps[activeIndex];
    if (currentStep?.onLeave) {
      currentStep.onLeave(contextRef.current);
    }

    const prevIndex = activeIndex - 1;
    if (prevIndex < 0) return;
    setActiveIndex(prevIndex);
    goToStep(prevIndex);
  }, [activeIndex, goToStep]);

  const skip = useCallback(() => {
    markComplete();
  }, [markComplete]);

  useEffect(() => {
    return () => {
      cleanupTracking();
      detachScrollListeners();
    };
  }, [cleanupTracking, detachScrollListeners]);

  return {
    isActive,
    currentStep: activeIndex,
    totalSteps: filteredRef.current.length,
    step: isActive ? filteredRef.current[activeIndex] ?? null : null,
    targetRect,
    transitioning,
    start,
    next,
    prev,
    skip,
  };
}
