import * as React from 'react';

/** Wrapper that measures children and smoothly animates height changes via ResizeObserver. */
export function AnimatedHeight({ children, className, disableTransition }: { children: React.ReactNode; className?: string; disableTransition?: boolean }) {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | undefined>(undefined);
  const [shouldAnimate, setShouldAnimate] = React.useState(false);

  React.useEffect(() => {
    const inner = innerRef.current;
    const outer = outerRef.current;
    if (!inner || !outer) return;
    // Padding is static (Tailwind classes), compute once
    const style = getComputedStyle(outer);
    const pad = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const ro = new ResizeObserver((entries) => {
      const contentH = entries[0]?.contentRect.height;
      if (contentH != null) setHeight(contentH + pad);
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  // Enable transitions only after the initial height has been painted
  React.useEffect(() => {
    if (height != null && !shouldAnimate) {
      requestAnimationFrame(() => { setShouldAnimate(true); });
    }
  }, [height, shouldAnimate]);

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        height: height != null ? height : undefined,
        transition: shouldAnimate && !disableTransition ? 'height 0.1s ease' : undefined,
      }}
    >
      <div ref={innerRef}>
        {children}
      </div>
    </div>
  );
}
