import { ChevronRight, Clock, List, LogOut, Pencil, Settings, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';

interface LocationSettingsMenuProps {
  isAdmin: boolean;
  onRename: () => void;
  onRetention: () => void;
  onCustomFields: () => void;
  onDelete: () => void;
  onLeave: () => void;
  compact?: boolean;
}

export function LocationSettingsMenu({ isAdmin, onRename, onRetention, onCustomFields, onDelete, onLeave, compact }: LocationSettingsMenuProps) {
  const { visible, animating, isOpen, close, toggle } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, close);

  function handleItem(action: () => void) {
    close();
    action();
  }

  if (!isAdmin) {
    return (
      <Tooltip content="Leave" side="bottom">
        <Button
          variant="ghost"
          size={compact ? 'sm' : 'sm'}
          px={compact ? '0' : undefined}
          onClick={onLeave}
          aria-label="Leave"
          className={compact
            ? 'h-7 w-7 rounded-full text-red-500 dark:text-red-400'
            : 'rounded-[var(--radius-full)] h-8 px-3 text-red-500 dark:text-red-400'
          }
        >
          <LogOut className="h-3.5 w-3.5" />
          {!compact && <span className="ml-1.5">Leave</span>}
        </Button>
      </Tooltip>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <Tooltip content="Settings" side="bottom">
        <Button
          variant="ghost"
          size={compact ? 'sm' : 'sm'}
          px={compact ? '0' : undefined}
          onClick={toggle}
          className={compact
            ? 'h-7 w-7 rounded-full'
            : 'rounded-[var(--radius-full)] h-8 px-3'
          }
          aria-label="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
          {!compact && (
            <>
              <span className="ml-1.5">Settings</span>
              <ChevronRight className={`h-3.5 w-3.5 ml-1 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </>
          )}
        </Button>
      </Tooltip>
      {visible && (
        <div className={`${animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter'} absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-[var(--radius-lg)] py-1 shadow-lg border border-[var(--border-glass)]`}>
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors"
            onClick={() => handleItem(onRename)}
          >
            <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            Rename
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors"
            onClick={() => handleItem(onRetention)}
          >
            <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            Data Retention
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors"
            onClick={() => handleItem(onCustomFields)}
          >
            <List className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            Custom Fields
          </button>
          <div className="my-1 border-t border-[var(--border-glass)]" />
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-red-500 dark:text-red-400 hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors"
            onClick={() => handleItem(onDelete)}
          >
            <Trash2 className="h-4 w-4" />
            Delete Location
          </button>
        </div>
      )}
    </div>
  );
}
