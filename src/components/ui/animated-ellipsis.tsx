/**
 * Three-dot animated ellipsis. Each dot fades in/out with a 200ms stagger,
 * producing a wave that reads as "live, not stuck."
 *
 * Decorative — wrap your live region (aria-live) elsewhere; this is aria-hidden.
 * Disabled by `prefers-reduced-motion: reduce` (dots stay fully visible).
 */
export function AnimatedEllipsis() {
  return (
    <span className="ai-ellipsis" aria-hidden="true">
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}
