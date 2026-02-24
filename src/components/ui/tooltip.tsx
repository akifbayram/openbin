import { useState, useRef, cloneElement, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: ReactElement<{ onMouseEnter?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler; onFocus?: React.FocusEventHandler; onBlur?: React.FocusEventHandler }>;
  side?: 'top' | 'bottom';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  function show() {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), 400);
  }

  function hide() {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  }

  return (
    <span className="relative inline-flex">
      {cloneElement(children, {
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      })}
      <span
        role="tooltip"
        className={cn(
          'absolute left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded-[var(--radius-sm)] text-[12px] font-medium whitespace-nowrap pointer-events-none',
          'glass-heavy text-[var(--text-primary)]',
          'transition-all duration-150 ease-out motion-reduce:transition-none',
          side === 'top' && 'bottom-full mb-1.5',
          side === 'bottom' && 'top-full mt-1.5',
          visible
            ? 'opacity-100 translate-y-0 visible'
            : cn('opacity-0 invisible', side === 'top' ? 'translate-y-1' : '-translate-y-1'),
        )}
      >
        {content}
      </span>
    </span>
  );
}
