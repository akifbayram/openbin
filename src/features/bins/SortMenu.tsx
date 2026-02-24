import { useState, useRef, useCallback } from 'react';
import { ArrowUpDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useClickOutside } from '@/lib/useClickOutside';
import type { SortOption } from './useBins';

const sortLabels: Record<SortOption, string> = {
  updated: 'Recently Updated',
  created: 'Recently Created',
  name: 'Name',
};

interface SortMenuProps {
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function SortMenu({ sort, onSortChange }: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(menuRef, close);

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="secondary"
        size="icon"
        onClick={() => setOpen(!open)}
        className="shrink-0 h-10 w-10 rounded-full relative"
        aria-label={`Sort by ${sortLabels[sort]}`}
      >
        <ArrowUpDown className="h-4 w-4" />
        {sort !== 'updated' && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
        )}
      </Button>
      {open && (
        <div className="animate-popover-enter absolute right-0 mt-1 w-48 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-lg overflow-hidden z-20">
          {(Object.keys(sortLabels) as SortOption[]).map((key) => (
            <button
              key={key}
              onClick={() => { onSortChange(key); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Check className={cn('h-4 w-4', sort === key ? 'text-[var(--accent)]' : 'invisible')} />
              {sortLabels[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
