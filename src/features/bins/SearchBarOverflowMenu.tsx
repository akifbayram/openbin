import { Settings2 } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';
import { FieldToggleList } from './ColumnVisibilityMenu';
import type { ViewMode } from './useViewMode';
import { ViewModeToggle } from './ViewModeToggle';

interface SearchBarOverflowMenuProps {
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  applicableFields: string[];
  visibility: Record<string, boolean>;
  onColumnToggle: (field: string) => void;
  customFieldLabels?: Record<string, string>;
}

export function SearchBarOverflowMenu({ viewMode, onViewModeChange, applicableFields, visibility, onColumnToggle, customFieldLabels }: SearchBarOverflowMenuProps) {
  const { visible, animating, isOpen, close, toggle } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, close);

  return (
    <div ref={menuRef} className="relative">
      <Tooltip content="View settings" side="bottom">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="h-10 w-10 rounded-[var(--radius-sm)]"
          aria-label="View settings"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <Settings2 className="h-5 w-5" />
        </Button>
      </Tooltip>
      {visible && (
        <div className={cn(
          animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
          'absolute right-0 mt-1 w-56 rounded-[var(--radius-md)] flat-popover overflow-hidden z-20',
        )}>
          <div className="ui-eyebrow px-3.5 py-2">
            View
          </div>
          <div className="px-3.5 pb-2">
            <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
          </div>
          {applicableFields.length > 0 && (
            <>
              <div className="ui-eyebrow px-3.5 py-2 border-t border-[var(--border-subtle)]">
                Fields
              </div>
              <FieldToggleList fields={applicableFields} visibility={visibility} onToggle={onColumnToggle} customFieldLabels={customFieldLabels} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
