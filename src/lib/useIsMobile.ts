import { useMediaQuery } from './useMediaQuery';

/** Reactive hook that returns true on viewports below the `lg` breakpoint (1024px). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
