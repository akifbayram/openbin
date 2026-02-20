import { useState, useRef, useCallback, useEffect } from 'react';
import { CheckCircle2, Tag, MapPin, Trash2, X, MoreHorizontal, Palette, Box, Eye, ArrowRightLeft, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClickOutside } from '@/lib/useClickOutside';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  selectedCount: number;
  isAdmin: boolean;
  onTag: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
  onColor: () => void;
  onIcon: () => void;
  onVisibility: () => void;
  onMoveLocation: () => void;
  onPin: () => void;
  pinLabel: string;
}

export function BulkActionBar({ selectedCount, isAdmin, onTag, onMove, onDelete, onClear, onColor, onIcon, onVisibility, onMoveLocation, onPin, pinLabel }: BulkActionBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useClickOutside(moreRef, useCallback(() => setMoreOpen(false), []));

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function handleMoreAction(action: () => void) {
    setMoreOpen(false);
    action();
  }

  return (
    <div className={cn(
      'fixed z-50 left-1/2 -translate-x-1/2 lg:left-[calc(50%+130px)]',
      'bottom-[calc(76px+var(--safe-bottom))] lg:bottom-8',
      'transition-all duration-200',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
    )}>
    <div className="glass-card rounded-[var(--radius-full)] flex items-center gap-2 px-4 py-2.5 shadow-lg">
      <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
      <span className="text-[13px] font-medium text-[var(--text-secondary)] flex-1">
        {selectedCount} selected
      </span>
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 rounded-[var(--radius-full)]"
          onClick={onTag}
        >
          <Tag className="h-3.5 w-3.5 mr-1.5" />
          Tag
        </Button>
      )}
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 rounded-[var(--radius-full)]"
          onClick={onMove}
        >
          <MapPin className="h-3.5 w-3.5 mr-1.5" />
          Move
        </Button>
      )}
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 rounded-[var(--radius-full)] text-[var(--destructive)]"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete
        </Button>
      )}
      {isAdmin && (
        <div className="relative" ref={moreRef}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setMoreOpen((o) => !o)}
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {moreOpen && (
            <div className="absolute bottom-full mb-2 right-0 glass-heavy rounded-[var(--radius-md)] py-1 min-w-[180px] z-50 shadow-lg">
              <button
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => handleMoreAction(onColor)}
              >
                <Palette className="h-4 w-4 text-[var(--text-tertiary)]" />
                Change Color
              </button>
              <button
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => handleMoreAction(onIcon)}
              >
                <Box className="h-4 w-4 text-[var(--text-tertiary)]" />
                Change Icon
              </button>
              <button
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => handleMoreAction(onVisibility)}
              >
                <Eye className="h-4 w-4 text-[var(--text-tertiary)]" />
                Change Visibility
              </button>
              <button
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => handleMoreAction(onMoveLocation)}
              >
                <ArrowRightLeft className="h-4 w-4 text-[var(--text-tertiary)]" />
                Move to Location
              </button>
              <button
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => handleMoreAction(onPin)}
              >
                <Pin className="h-4 w-4 text-[var(--text-tertiary)]" />
                {pinLabel}
              </button>
            </div>
          )}
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
    </div>
  );
}
