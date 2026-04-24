import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserPreferences } from '@/lib/userPreferences';
import { getTour, markTourSeen, TOURS_VERSION, type TourDefinition, type TourId } from './tourRegistry';
import {
  filterSteps,
  resolveRoute,
  resolveSelector,
  type TourContext,
  type TourStep,
} from './tourSteps';

/** Pick the first element that is actually rendered (non-zero layout box).
 *  Skips hidden duplicates like mobile-nav counterparts when tour runs on desktop. */
function pickVisible(selector: string): Element | null {
  const candidates = document.querySelectorAll(selector);
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

/** Poll for a DOM element by selector. Resolves with the element or null on timeout. */
function waitForElement(selector: string, timeoutMs = 3000): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = pickVisible(selector);
    if (el) { resolve(el); return; }
    const start = performance.now();
    function poll() {
      const found = pickVisible(selector);
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
  updatePreferences: (
    patch: Partial<UserPreferences> | ((prev: UserPreferences) => Partial<UserPreferences>),
  ) => void;
  /** Called when the tour can't find any anchors (e.g. empty page). */
  onUnavailable?: (tourId: TourId) => void;
}

export interface UseTourReturn {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  step: TourStep | null;
  targetRect: DOMRect | null;
  transitioning: boolean;
  currentTourId: TourId | null;
  start: (tourId: TourId) => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
}

export function useTour({ context, navigate, updatePreferences, onUnavailable }: UseTourDeps): UseTourReturn {
  const [isActive, setIsActive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [currentTourId, setCurrentTourId] = useState<TourId | null>(null);

  const filteredRef = useRef<TourStep[]>([]);
  const tourDefRef = useRef<TourDefinition | null>(null);
  // Tracks whether any step ever found its anchor. If every step auto-skips we
  // notify via `onUnavailable` so callers can show a toast instead of ending
  // the tour silently.
  const shownAnyStepRef = useRef(false);
  const contextRef = useRef(context);
  contextRef.current = context;

  const observerRef = useRef<ResizeObserver | null>(null);
  const elementRef = useRef<Element | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const navigatingRef = useRef(false);
  // goToStep recursively calls markComplete, but markComplete is declared after.
  // A ref keeps goToStep's dep list stable without a stale closure.
  const markCompleteRef = useRef<() => void>(() => {});

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
        markCompleteRef.current();
        return;
      }

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise<void>((r) => setTimeout(r, 300));

      trackElement(el);
      shownAnyStepRef.current = true;
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
    const endedTourId = currentTourId;
    const shownAny = shownAnyStepRef.current;
    tourDefRef.current?.onEnd?.(contextRef.current);
    tourDefRef.current = null;
    shownAnyStepRef.current = false;
    if (!shownAny && endedTourId) onUnavailable?.(endedTourId);
    cleanupTracking();
    detachScrollListeners();
    setTargetRect(null);
    setIsActive(false);
    setActiveIndex(0);
    filteredRef.current = [];

    const tourId = currentTourId;
    setCurrentTourId(null);
    if (tourId) {
      updatePreferences((prev) => ({
        tours_seen: markTourSeen(prev.tours_seen, tourId),
        tours_version: TOURS_VERSION,
      }));
    }
  }, [activeIndex, cleanupTracking, detachScrollListeners, updatePreferences, currentTourId, onUnavailable]);

  markCompleteRef.current = markComplete;

  const start = useCallback((tourId: TourId) => {
    const def = getTour(tourId);
    if (!def) return;
    const filtered = filterSteps(def.steps, contextRef.current);
    if (filtered.length === 0) {
      console.warn(`[tour:${tourId}] no steps available in the current context`);
      onUnavailable?.(tourId);
      return;
    }
    tourDefRef.current = def;
    filteredRef.current = filtered;
    shownAnyStepRef.current = false;
    setCurrentTourId(tourId);
    setActiveIndex(0);
    setIsActive(true);
    goToStep(0);
  }, [goToStep, onUnavailable]);

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
    currentTourId,
    start,
    next,
    prev,
    skip,
  };
}
