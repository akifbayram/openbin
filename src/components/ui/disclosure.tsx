import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { cn, focusRing } from '@/lib/utils';

interface DisclosureProps {
  label: ReactNode;
  defaultOpen?: boolean;
  indicator?: boolean;
  labelClassName?: string;
  children: ReactNode;
}

export function Disclosure({ label, defaultOpen = false, indicator, labelClassName, children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
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
        <div className="overflow-hidden min-h-0 -mx-1.5 px-1.5">
          <div className={cn('mt-2 transition-opacity duration-200 motion-reduce:transition-none', open ? 'opacity-100' : 'opacity-0')}>
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}
