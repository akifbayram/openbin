import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { cn, focusRing } from '@/lib/utils';

interface DisclosureProps {
  label: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  indicator?: boolean;
  labelClassName?: string;
  children: ReactNode;
}

export function Disclosure({ label, open: controlledOpen, defaultOpen = false, onOpenChange, indicator, labelClassName, children }: DisclosureProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const contentId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const next = !open;
          if (!isControlled) setInternalOpen(next);
          onOpenChange?.(next);
        }}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn('flex items-center justify-between w-full text-[13px] text-[var(--text-secondary)] font-medium rounded-[var(--radius-xs)]', focusRing, labelClassName)}
      >
        <span className="flex items-center gap-1.5">
          {label}
          {indicator && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <section
        id={contentId}
        aria-hidden={!open}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        {/* @ts-expect-error -- inert is valid HTML but not typed in React 18 */}
        <div className="overflow-hidden min-h-0 -mx-1.5 px-1.5" inert={!open ? true : undefined}>
          <div className={cn('mt-2 transition-opacity duration-200 motion-reduce:transition-none', open ? 'opacity-100' : 'opacity-0')}>
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}
