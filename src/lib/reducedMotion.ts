/**
 * Whether the user has requested reduced motion via OS preference. Returns
 * `false` server-side so callers don't need a separate SSR guard.
 *
 * Use to skip non-essential animations: long entrance/exit transitions,
 * scroll-driven effects, decorative idle motion, or held confirmation beats.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
