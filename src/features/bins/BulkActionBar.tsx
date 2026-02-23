import { useState, useRef, useCallback, useEffect } from 'react';
import { CheckCircle2, Tag, MapPin, Trash2, X, MoreHorizontal, Paintbrush, Eye, ArrowRightLeft, Pin, Copy, Clipboard, ClipboardPaste } from 'lucide-react';
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
  onAppearance: () => void;
  onVisibility: () => void;
  onMoveLocation: () => void;
  onPin: () => void;
  onDuplicate: () => void;
  pinLabel: string;
  onCopyStyle?: () => void;
  onPasteStyle?: () => void;
  canCopyStyle?: boolean;
  canPasteStyle?: boolean;
}

export function BulkActionBar({ selectedCount, isAdmin, onTag, onMove, onDelete, onClear, onAppearance, onVisibility, onMoveLocation, onPin, onDuplicate, pinLabel, onCopyStyle, onPasteStyle, canCopyStyle, canPasteStyle }: BulkActionBarProps) {
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
      'fixed z-50 left-1/2 -translate-x-1/2 lg:left-[calc(50%+130px)] max-w-[calc(100vw-2.5rem)]',
      'bottom-[calc(76px+var(--safe-bottom))] lg:bottom-8',
      'transition-all duration-200',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
    )}>
    <div className="glass-heavy rounded-[var(--radius-full)] flex items-center gap-2 px-4 py-2.5 shadow-lg">
      <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
      <span className="text-[13px] font-medium text-[var(--text-secondary)] whitespace-nowrap">
        {selectedCount} selected
      </span>
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 sm:px-3 rounded-[var(--radius-full)]"
          onClick={onTag}
          aria-label="Tag"
        >
          <Tag className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Tag</span>
        </Button>
      )}
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 sm:px-3 rounded-[var(--radius-full)]"
          onClick={onMove}
          aria-label="Move"
        >
          <MapPin className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Move</span>
        </Button>
      )}
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 sm:px-3 rounded-[var(--radius-full)] text-[var(--destructive)]"
          onClick={onDelete}
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Delete</span>
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
                onClick={() => handleMoreAction(onAppearance)}
              >
                <Paintbrush className="h-4 w-4 text-[var(--text-tertiary)]" />
                Appearance
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
              <button
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => handleMoreAction(onDuplicate)}
              >
                <Copy className="h-4 w-4 text-[var(--text-tertiary)]" />
                Duplicate
              </button>
              {(canCopyStyle || canPasteStyle) && (
                <div className="my-1 border-t border-[var(--border-primary)]" />
              )}
              {canCopyStyle && onCopyStyle && (
                <button
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => handleMoreAction(onCopyStyle)}
                >
                  <Clipboard className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Copy Style
                </button>
              )}
              {canPasteStyle && onPasteStyle && (
                <button
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => handleMoreAction(onPasteStyle)}
                >
                  <ClipboardPaste className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Paste Style
                </button>
              )}
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
