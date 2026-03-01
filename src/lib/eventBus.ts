import { useEffect, useMemo, useState } from 'react';

export const Events = {
  BINS: 'bins-changed',
  LOCATIONS: 'locations-changed',
  PHOTOS: 'photos-changed',
  PINS: 'pins-changed',
  AREAS: 'areas-changed',
  TAG_COLORS: 'tag-colors-changed',
  SCAN_HISTORY: 'scan-history-changed',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

/** Dispatch a DOM event to trigger all listeners for the given event name. */
export function notify(event: EventName) {
  window.dispatchEvent(new Event(event));
}

/**
 * React hook that returns a counter that increments whenever any of the
 * specified events fire. Use this as a useEffect dependency to trigger refetch.
 */
export function useRefreshOn(...events: EventName[]): number {
  const [counter, setCounter] = useState(0);
  const key = events.join(',');
  const stableEvents = useMemo(() => events, [key]);

  useEffect(() => {
    const handler = () => setCounter((c) => c + 1);
    for (const event of stableEvents) {
      window.addEventListener(event, handler);
    }
    return () => {
      for (const event of stableEvents) {
        window.removeEventListener(event, handler);
      }
    };
  }, [stableEvents]);

  return counter;
}
