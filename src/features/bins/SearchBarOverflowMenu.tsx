import { MoreHorizontal } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { FieldToggleList } from './ColumnVisibilityMenu';
import type { FieldKey } from './useColumnVisibility';
import type { ViewMode } from './useViewMode';
import { ViewModeToggle } from './ViewModeToggle';

interface SearchBarOverflowMenuProps {
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  applicableFields: FieldKey[];
  visibility: Record<FieldKey, boolean>;
  onColumnToggle: (field: FieldKey) => void;
}

export function SearchBarOverflowMenu({ viewMode, onViewModeChange, applicableFields, visibility, onColumnToggle }: SearchBarOverflowMenuProps) {
  const { visible, animating, isOpen, close, toggle } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, close);

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="secondary"
        size="icon"
        onClick={toggle}
        className="shrink-0 h-10 w-10 rounded-full"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {visible && (
        <div className={`${animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter'} absolute right-0 mt-1 w-56 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] backdrop-blur-xl shadow-lg overflow-hidden z-20`}>
          <div className="px-3.5 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
            View
          </div>
          <div className="px-3.5 pb-2">
            <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
          </div>
          {applicableFields.length > 0 && (
            <>
              <div className="px-3.5 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide border-t border-[var(--border-subtle)]">
                Fields
              </div>
              <FieldToggleList fields={applicableFields} visibility={visibility} onToggle={onColumnToggle} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
