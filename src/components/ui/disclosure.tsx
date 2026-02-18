import { useState, useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DisclosureProps {
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Disclosure({ label, defaultOpen = false, children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex items-center justify-between w-full text-[13px] text-[var(--text-secondary)] font-medium"
      >
        {label}
        <ChevronDown className={cn('h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && <div id={contentId} role="region" className="mt-2">{children}</div>}
    </div>
  );
}
