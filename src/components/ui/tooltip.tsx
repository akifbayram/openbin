import { useState, useRef, useEffect, useCallback, cloneElement, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const GAP = 6;

interface TooltipProps {
  content: string;
  children: ReactElement<{ onMouseEnter?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler; onFocus?: React.FocusEventHandler; onBlur?: React.FocusEventHandler }>;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

function computePosition(triggerRect: DOMRect, tooltipRect: DOMRect, side: 'top' | 'bottom' | 'left' | 'right') {
  switch (side) {
    case 'top':
      return { top: triggerRect.top - tooltipRect.height - GAP, left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2 };
    case 'bottom':
      return { top: triggerRect.bottom + GAP, left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2 };
    case 'left':
      return { top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2, left: triggerRect.left - tooltipRect.width - GAP };
    case 'right':
      return { top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2, left: triggerRect.right + GAP };
  }
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [positioned, setPositioned] = useState(false);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const posRef = useRef({ top: 0, left: 0 });

  const show = useCallback(() => {
    clearTimeout(showTimeoutRef.current);
    showTimeoutRef.current = setTimeout(() => setVisible(true), 400);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(showTimeoutRef.current);
    setVisible(false);
    setPositioned(false);
  }, []);

  // Position the tooltip once it mounts, dismiss on scroll/resize
  useEffect(() => {
    if (!visible) return;

    const frame = requestAnimationFrame(() => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;
      posRef.current = computePosition(trigger.getBoundingClientRect(), tooltip.getBoundingClientRect(), side);
      setPositioned(true);
    });

    const dismiss = () => hide();
    window.addEventListener('scroll', dismiss, { capture: true, passive: true });
    window.addEventListener('resize', dismiss);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', dismiss, { capture: true });
      window.removeEventListener('resize', dismiss);
    };
  }, [visible, side, hide]);

  return (
    <span ref={triggerRef} className={cn('inline-flex', className)}>
      {cloneElement(children, {
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      })}
      {visible && createPortal(
        <span
          ref={tooltipRef}
          role="tooltip"
          className={cn(
            'fixed z-[80] px-2.5 py-1 rounded-[var(--radius-sm)] text-[12px] font-medium whitespace-nowrap pointer-events-none',
            'glass-heavy text-[var(--text-primary)]',
            'transition-all duration-150 ease-out motion-reduce:transition-none',
            positioned ? 'opacity-100' : 'opacity-0',
          )}
          style={{ top: posRef.current.top, left: posRef.current.left }}
        >
          {content}
        </span>,
        document.body,
      )}
    </span>
  );
}
