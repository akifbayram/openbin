import { ArrowRightLeft, CheckCircle2, Clipboard, ClipboardPaste, Copy, Eye, List, type LucideIcon, MapPin, MoreHorizontal, Paintbrush, Pin, Printer, Shuffle, Sparkles, Tag, Trash2, X } from 'lucide-react';
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

interface PrimaryAction {
  id: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  show: boolean;
  danger?: boolean;
}

interface MoreAction {
  id: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  show: boolean;
  dividerBefore?: boolean;
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

  const primaryActions: PrimaryAction[] = [
    { id: 'tag', icon: Tag, label: 'Tag', onClick: onTag, show: isAdmin },
    { id: 'move', icon: MapPin, label: 'Move', onClick: onMove, show: isAdmin },
    { id: 'print', icon: Printer, label: 'Print', onClick: onPrint ?? (() => {}), show: Boolean(onPrint) },
    { id: 'delete', icon: Trash2, label: 'Delete', onClick: onDelete, show: isAdmin, danger: true },
    { id: 'ai', icon: Sparkles, label: 'AI', onClick: onAskAi ?? (() => {}), show: Boolean((aiEnabled || aiGated) && canWrite && onAskAi) },
  ];

  const showStyleDivider = Boolean(canCopyStyle || canPasteStyle);
  const moreActions: MoreAction[] = [
    { id: 'appearance', icon: Paintbrush, label: 'Appearance', onClick: onAppearance, show: true },
    { id: 'visibility', icon: Eye, label: 'Change Visibility', onClick: onVisibility, show: true },
    { id: 'moveLocation', icon: ArrowRightLeft, label: 'Move to Location', onClick: onMoveLocation, show: true },
    { id: 'pin', icon: Pin, label: pinLabel, onClick: onPin, show: true },
    { id: 'duplicate', icon: Copy, label: 'Duplicate', onClick: onDuplicate, show: true },
    { id: 'reorganize', icon: Shuffle, label: 'Reorganize', onClick: onReorganize ?? (() => {}), show: Boolean(aiEnabled && onReorganize) },
    { id: 'customFields', icon: List, label: 'Custom Fields', onClick: onCustomFields ?? (() => {}), show: Boolean(onCustomFields) },
    { id: 'copyStyle', icon: Clipboard, label: 'Copy Style', onClick: onCopyStyle ?? (() => {}), show: Boolean(canCopyStyle && onCopyStyle), dividerBefore: showStyleDivider },
    { id: 'pasteStyle', icon: ClipboardPaste, label: 'Paste Style', onClick: onPasteStyle ?? (() => {}), show: Boolean(canPasteStyle && onPasteStyle), dividerBefore: showStyleDivider && !canCopyStyle },
  ];

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
      {primaryActions.filter((a) => a.show).map((action) => {
        const Icon = action.icon;
        return (
          <Tooltip key={action.id} content={action.label} side="top">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-2 sm:px-3',
                action.danger ? 'text-red-300 hover:bg-red-500/25 hover:text-red-200' : 'text-white hover:bg-white/15'
              )}
              onClick={action.onClick}
              disabled={isBusy}
              aria-label={action.label}
            >
              <Icon className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">{action.label}</span>
            </Button>
          </Tooltip>
        );
      })}
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
              {moreActions.filter((a) => a.show).map((action) => {
                const Icon = action.icon;
                return (
                  <div key={action.id}>
                    {action.dividerBefore && <div className="my-1 border-t border-[var(--border-primary)]" />}
                    <button
                      type="button"
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                      onClick={() => handleMoreAction(action.onClick)}
                    >
                      <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />
                      {action.label}
                    </button>
                  </div>
                );
              })}
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
