import { useState, useRef } from 'react';
import { Settings, Pencil, Clock, Trash2, LogOut, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClickOutside } from '@/lib/useClickOutside';

interface LocationSettingsMenuProps {
  isAdmin: boolean;
  onRename: () => void;
  onRetention: () => void;
  onDelete: () => void;
  onLeave: () => void;
  compact?: boolean;
}

export function LocationSettingsMenu({ isAdmin, onRename, onRetention, onDelete, onLeave, compact }: LocationSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setOpen(false));

  function handleItem(action: () => void) {
    setOpen(false);
    action();
  }

  if (!isAdmin) {
    return (
      <Button
        variant="ghost"
        size={compact ? 'icon' : 'sm'}
        onClick={onLeave}
        className={compact
          ? 'h-7 w-7 rounded-full text-[var(--destructive)]'
          : 'rounded-[var(--radius-full)] h-8 px-3 text-[var(--destructive)]'
        }
      >
        <LogOut className="h-3.5 w-3.5" />
        {!compact && <span className="ml-1.5">Leave</span>}
      </Button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size={compact ? 'icon' : 'sm'}
        onClick={() => setOpen(!open)}
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
            <ChevronRight className={`h-3.5 w-3.5 ml-1 transition-transform ${open ? 'rotate-90' : ''}`} />
          </>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] glass-heavy rounded-[var(--radius-lg)] py-1 shadow-lg border border-[var(--border-glass)]">
          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => handleItem(onRename)}
          >
            <Pencil className="h-4 w-4 text-[var(--text-tertiary)]" />
            Rename
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => handleItem(onRetention)}
          >
            <Clock className="h-4 w-4 text-[var(--text-tertiary)]" />
            Data Retention
          </button>
          <div className="my-1 border-t border-[var(--border-glass)]" />
          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--destructive)] hover:bg-[var(--bg-hover)] transition-colors"
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
