import { ArrowRightLeft, CheckCircle2, Clipboard, ClipboardPaste, Copy, Eye, List, MapPin, MoreHorizontal, Paintbrush, Pin, Printer, Shuffle, Sparkles, Tag, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useClickOutside } from '@/lib/useClickOutside';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  selectedCount: number;
  isAdmin: boolean;
  canWrite?: boolean;
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
  onCustomFields?: () => void;
  canCopyStyle?: boolean;
  canPasteStyle?: boolean;
  isBusy?: boolean;
  aiEnabled?: boolean;
  aiGated?: boolean;
  onAskAi?: () => void;
  onReorganize?: () => void;
  onPrint?: () => void;
}

export function BulkActionBar({ selectedCount, isAdmin, canWrite = true, onTag, onMove, onDelete, onClear, onAppearance, onVisibility, onMoveLocation, onPin, onDuplicate, pinLabel, onCustomFields, onCopyStyle, onPasteStyle, canCopyStyle, canPasteStyle, isBusy, aiEnabled, aiGated, onAskAi, onReorganize, onPrint }: BulkActionBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useClickOutside(moreRef, useCallback(() => setMoreOpen(false), []));

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  if (!canWrite) return null;

  function handleMoreAction(action: () => void) {
    setMoreOpen(false);
    action();
  }

  return (
    <div className={cn(
      'fixed z-50 left-1/2 -translate-x-1/2 lg:left-[calc(50%+130px)] max-w-[calc(100vw-2.5rem)]',
      'bottom-[calc(12px+var(--bottom-bar-height)+var(--safe-bottom))] lg:bottom-8',
      'transition-all duration-200',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
    )}>
    <div className="rounded-[var(--radius-md)] row px-3 py-2 bg-[var(--accent)] border border-[var(--accent-hover)] text-white sm:min-w-[400px] lg:min-w-[480px]">
      <CheckCircle2 className="h-4 w-4 text-white/80" />
      <span className="text-[13px] font-medium text-white/90 whitespace-nowrap">
        {selectedCount} selected
      </span>
      <div className="h-4 border-l border-white/20" />
      {isAdmin && (
        <Tooltip content="Tag" side="top">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 sm:px-3 text-white hover:bg-white/15"
            onClick={onTag}
            disabled={isBusy}
            aria-label="Tag"
          >
            <Tag className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Tag</span>
          </Button>
        </Tooltip>
      )}
      {isAdmin && (
        <Tooltip content="Move" side="top">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 sm:px-3 text-white hover:bg-white/15"
            onClick={onMove}
            disabled={isBusy}
            aria-label="Move"
          >
            <MapPin className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Move</span>
          </Button>
        </Tooltip>
      )}
      {onPrint && (
        <Tooltip content="Print" side="top">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 sm:px-3 text-white hover:bg-white/15"
            onClick={onPrint}
            disabled={isBusy}
            aria-label="Print"
          >
            <Printer className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </Tooltip>
      )}
      {isAdmin && (
        <Tooltip content="Delete" side="top">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 sm:px-3 text-red-300 hover:bg-red-500/25 hover:text-red-200"
            onClick={onDelete}
            disabled={isBusy}
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </Tooltip>
      )}
      {(aiEnabled || aiGated) && canWrite && onAskAi && (
        <Tooltip content="AI" side="top">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 sm:px-3 text-white hover:bg-white/15"
            onClick={onAskAi}
            disabled={isBusy}
            aria-label="AI"
          >
            <Sparkles className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">AI</span>
          </Button>
        </Tooltip>
      )}
      {isAdmin && (
        <div className="relative" ref={moreRef}>
          <Tooltip content="More actions" side="top">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-[var(--radius-xs)] text-white hover:bg-white/15"
              onClick={() => setMoreOpen((o) => !o)}
              disabled={isBusy}
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </Tooltip>
          {moreOpen && (
            <div className="absolute bottom-full mb-2 right-0 rounded-[var(--radius-md)] min-w-[180px] z-50 flat-popover overflow-hidden">
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => handleMoreAction(onAppearance)}
              >
                <Paintbrush className="h-4 w-4 text-[var(--text-tertiary)]" />
                Appearance
              </button>
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => handleMoreAction(onVisibility)}
              >
                <Eye className="h-4 w-4 text-[var(--text-tertiary)]" />
                Change Visibility
              </button>
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => handleMoreAction(onMoveLocation)}
              >
                <ArrowRightLeft className="h-4 w-4 text-[var(--text-tertiary)]" />
                Move to Location
              </button>
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => handleMoreAction(onPin)}
              >
                <Pin className="h-4 w-4 text-[var(--text-tertiary)]" />
                {pinLabel}
              </button>
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => handleMoreAction(onDuplicate)}
              >
                <Copy className="h-4 w-4 text-[var(--text-tertiary)]" />
                Duplicate
              </button>
              {aiEnabled && onReorganize && (
                <button
                  type="button"
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => handleMoreAction(onReorganize)}
                >
                  <Shuffle className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Reorganize
                </button>
              )}
              {onCustomFields && (
                <button
                  type="button"
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => handleMoreAction(onCustomFields)}
                >
                  <List className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Custom Fields
                </button>
              )}
              {(canCopyStyle || canPasteStyle) && (
                <div className="my-1 border-t border-[var(--border-primary)]" />
              )}
              {canCopyStyle && onCopyStyle && (
                <button
                  type="button"
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => handleMoreAction(onCopyStyle)}
                >
                  <Clipboard className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Copy Style
                </button>
              )}
              {canPasteStyle && onPasteStyle && (
                <button
                  type="button"
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
      <div className="h-4 border-l border-white/20" />
      <Tooltip content="Clear selection" side="top">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-[var(--radius-xs)] text-white/70 hover:bg-white/15 hover:text-white"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
    </div>
  );
}
