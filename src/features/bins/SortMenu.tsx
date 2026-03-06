import { ArrowUpDown, Check } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';
import type { SortOption } from './useBins';

const sortLabels: Record<SortOption, string> = {
  updated: 'Recently Updated',
  created: 'Recently Created',
  name: 'Name',
  area: 'Area',
};

interface SortMenuProps {
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function SortMenu({ sort, onSortChange }: SortMenuProps) {
  const { visible, animating, close, toggle } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, close);

  return (
    <div ref={menuRef} className="relative">
      <Tooltip content="Sort" side="bottom">
        <Button
          variant="ghost"
          size="sm" px="0"
          onClick={toggle}
          className="shrink-0 h-10 w-10 rounded-full relative"
          aria-label={`Sort by ${sortLabels[sort]}`}
        >
          <ArrowUpDown className="h-4 w-4" />
          {sort !== 'updated' && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-purple-600 dark:bg-purple-500" />
          )}
        </Button>
      </Tooltip>
      {visible && (
        <div className={`${animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter'} absolute right-0 mt-1 w-48 rounded-[var(--radius-md)] border border-black/6 dark:border-white/6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl shadow-lg overflow-hidden z-20`}>
          {(Object.keys(sortLabels) as SortOption[]).map((key) => (
            <button
              type="button"
              key={key}
              onClick={() => { onSortChange(key); close(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[15px]  hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors"
            >
              <Check className={cn('h-4 w-4', sort === key ? 'text-purple-600 dark:text-purple-400' : 'invisible')} />
              {sortLabels[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
