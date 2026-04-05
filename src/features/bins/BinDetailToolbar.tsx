import type { LucideIcon } from 'lucide-react';
import { ArrowRightLeft, ChevronLeft, ChevronRight, Copy, Loader2, Lock, MoreHorizontal, Pin, Printer, QrCode, Share2, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useTerminology } from '@/lib/terminology';
import { useClickOutside } from '@/lib/useClickOutside';
import { useMenuKeyboard } from '@/lib/useMenuKeyboard';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';
import type { Bin, Location } from '@/types';

interface BinDetailToolbarProps {
  bin: Bin;
  canEdit: boolean;
  canPin: boolean;
  canDelete: boolean;
  binIcon: LucideIcon;
  showAiButton: boolean;
  isAnalyzing: boolean;
  isReanalysis: boolean;
  otherLocations: Location[];
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  hasBinListContext: boolean;
  onAnalyze: () => void;
  onTogglePin: () => void;
  onPrint: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
  isAdmin: boolean;
  onChangeCode: () => void;
  onShare?: () => void;
  showShareButton: boolean;
  onSaveName: (name: string) => void;
  nameSaved: boolean;
}

export function BinDetailToolbar({
  bin,
  canEdit,
  canPin,
  canDelete,
  binIcon: BinIcon,
  showAiButton,
  isAnalyzing,
  isReanalysis,
  otherLocations,
  onClose,
  onPrev,
  onNext,
  hasBinListContext,
  onAnalyze,
  onTogglePin,
  onPrint,
  onDuplicate,
  onMove,
  onDelete,
  isAdmin,
  onChangeCode,
  onShare,
  showShareButton,
  onSaveName,
  nameSaved,
}: BinDetailToolbarProps) {
  const t = useTerminology();
  const { visible, animating, close, toggle } = usePopover();
  const wrapperRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapperRef, close);
  const { menuRef, onKeyDown: menuKeyDown } = useMenuKeyboard(visible, close);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(bin.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync name from bin prop
  const prevName = useRef(bin.name);
  if (bin.name !== prevName.current) {
    prevName.current = bin.name;
    if (!editingName) setNameValue(bin.name);
  }

  useEffect(() => {
    if (editingName) inputRef.current?.select();
  }, [editingName]);

  function commitName() {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== bin.name) {
      onSaveName(trimmed);
    } else {
      setNameValue(bin.name);
    }
  }

  const menuItemBase = 'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-150';

  function handleItem(action: () => void) {
    close();
    action();
  }

  return (
    <div className="flex items-center gap-0.5 lg:gap-2">
      {/* Desktop: nav arrows */}
      {hasBinListContext && (
        <div className="hidden lg:flex gap-1.5 shrink-0">
          <Tooltip content="Previous" side="bottom">
            <Button variant="ghost" size="icon" onClick={onPrev ?? undefined} disabled={!onPrev} aria-label="Previous bin">
              <ChevronLeft className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
          <Tooltip content="Next" side="bottom">
            <Button variant="ghost" size="icon" onClick={onNext ?? undefined} disabled={!onNext} aria-label="Next bin">
              <ChevronRight className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
        </div>
      )}

      <div className="min-w-0 flex-1 flex lg:justify-center">
        {editingName ? (
          <input
            ref={inputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitName(); }
              if (e.key === 'Escape') { e.preventDefault(); setNameValue(bin.name); setEditingName(false); }
            }}
            className="w-full bg-transparent text-[17px] font-semibold text-[var(--text-primary)] leading-tight border-b border-b-[var(--accent)] outline-none focus-visible:border-b-2 placeholder:text-[var(--text-tertiary)] p-0"
            placeholder="Name..."
          />
        ) : (
          <div
            className={cn(
              'row-tight min-w-0',
              canEdit && 'cursor-text',
              nameSaved && 'animate-save-flash',
            )}
            onClick={canEdit ? () => { setNameValue(bin.name); setEditingName(true); } : undefined}
            role={canEdit ? 'button' : undefined}
            tabIndex={canEdit ? 0 : undefined}
            onKeyDown={canEdit ? (e) => { if (e.key === 'Enter') { setNameValue(bin.name); setEditingName(true); } } : undefined}
          >
            <BinIcon className="hidden lg:block h-5 w-5 text-[var(--text-secondary)] shrink-0" />
            <span className="text-[17px] font-semibold text-[var(--text-primary)] leading-tight truncate">{bin.name}</span>
            {bin.visibility === 'private' && (
              <Lock className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
            )}
          </div>
        )}
      </div>

      <div className="flex gap-0.5 lg:gap-1.5 shrink-0">
        {/* Desktop-only action buttons */}
        <div className="hidden lg:flex gap-1.5">
          {showAiButton && (
            <Tooltip content={isReanalysis ? 'Reanalyze with AI' : 'Analyze with AI'} side="bottom">
              <Button size="icon" onClick={onAnalyze} disabled={isAnalyzing} aria-label={isReanalysis ? 'Reanalyze with AI' : 'Analyze with AI'} variant="ghost">
                {isAnalyzing ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Sparkles className="h-[18px] w-[18px]" />}
              </Button>
            </Tooltip>
          )}
          {canPin && (
            <Tooltip content={bin.is_pinned ? 'Unpin' : 'Pin'} side="bottom">
              <Button variant="ghost" size="icon" onClick={onTogglePin} aria-label={bin.is_pinned ? `Unpin ${t.bin}` : `Pin ${t.bin}`}>
                <Pin className="h-[18px] w-[18px]" fill={bin.is_pinned ? 'currentColor' : 'none'} />
              </Button>
            </Tooltip>
          )}
        </div>

        {/* More menu */}
        <div className="relative" ref={wrapperRef}>
          <Tooltip content="More" side="bottom">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="More actions">
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
          {visible && (
            <div
              ref={menuRef}
              role="menu"
              onKeyDown={menuKeyDown}
              className={cn(
                animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
                'absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-[var(--radius-lg)] flat-popover overflow-hidden',
              )}
            >
              {/* Mobile-only: AI, Pin */}
              {showAiButton && (
                <button type="button" role="menuitem" className={cn(menuItemBase, 'lg:hidden disabled:opacity-40')} onClick={() => handleItem(onAnalyze)} disabled={isAnalyzing}>
                  {isAnalyzing ? <Loader2 className="h-4 w-4 text-[var(--text-tertiary)] animate-spin" /> : <Sparkles className="h-4 w-4 text-[var(--text-tertiary)]" />}
                  {isReanalysis ? 'Reanalyze with AI' : 'Analyze with AI'}
                </button>
              )}
              {canPin && (
                <button type="button" role="menuitem" className={cn(menuItemBase, 'lg:hidden')} onClick={() => handleItem(onTogglePin)}>
                  <Pin className="h-4 w-4 text-[var(--text-tertiary)]" fill={bin.is_pinned ? 'currentColor' : 'none'} />
                  {bin.is_pinned ? 'Unpin' : 'Pin'}
                </button>
              )}
              {(showAiButton || canPin) && <div className="lg:hidden my-1 border-t border-[var(--border-flat)]" />}
              {canEdit && (
                <button type="button" role="menuitem" className={menuItemBase} onClick={() => handleItem(onDuplicate)}>
                  <Copy className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Duplicate
                </button>
              )}
              <button type="button" role="menuitem" className={menuItemBase} onClick={() => handleItem(onPrint)}>
                <Printer className="h-4 w-4 text-[var(--text-tertiary)]" />
                Print Label
              </button>
              {canEdit && otherLocations.length > 0 && (
                <button type="button" role="menuitem" className={menuItemBase} onClick={() => handleItem(onMove)}>
                  <ArrowRightLeft className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Move
                </button>
              )}
              {isAdmin && (
                <button type="button" role="menuitem" className={menuItemBase} onClick={() => handleItem(onChangeCode)}>
                  <QrCode className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Change Code
                </button>
              )}
              {showShareButton && onShare && (
                <button type="button" role="menuitem" className={menuItemBase} onClick={() => handleItem(onShare)}>
                  <Share2 className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Share
                </button>
              )}
              {canDelete && (
                <>
                  <div className="my-1 border-t border-[var(--border-flat)]" />
                  <button type="button" role="menuitem" className={cn(menuItemBase, 'text-[var(--destructive)]')} onClick={() => handleItem(onDelete)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Close */}
        <Tooltip content="Close" side="bottom">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="bg-[var(--bg-input)]">
            <X className="h-[18px] w-[18px]" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
