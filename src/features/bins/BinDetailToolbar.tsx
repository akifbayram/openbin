import type { LucideIcon } from 'lucide-react';
import { ArrowRightLeft, Check, ChevronLeft, ChevronRight, Copy, Loader2, Lock, MoreHorizontal, Pencil, Pin, Printer, QrCode, Save, Share2, Sparkles, Trash2, X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MenuButton } from '@/components/ui/menu-button';
import { Tooltip } from '@/components/ui/tooltip';
import { useTerminology } from '@/lib/terminology';
import { useClickOutside } from '@/lib/useClickOutside';
import { useMenuKeyboard } from '@/lib/useMenuKeyboard';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';
import type { Bin, Location } from '@/types';

interface BinDetailToolbarProps {
  bin: Bin;
  editing: boolean;
  canEdit: boolean;
  canPin: boolean;
  canDelete: boolean;
  binIcon: LucideIcon;
  editingName: string;
  onNameChange: (name: string) => void;
  showAiButton: boolean;
  isAnalyzing: boolean;
  isReanalysis: boolean;
  editNameValid: boolean;
  isSaving: boolean;
  otherLocations: Location[];
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  hasBinListContext: boolean;
  onCancelEdit: () => void;
  onSave: () => void;
  onStartEdit: () => void;
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
}

export function BinDetailToolbar({
  bin,
  editing,
  canEdit,
  canPin,
  canDelete,
  binIcon: BinIcon,
  editingName,
  onNameChange,
  showAiButton,
  isAnalyzing,
  isReanalysis,
  editNameValid,
  isSaving,
  otherLocations,
  onClose,
  onPrev,
  onNext,
  hasBinListContext,
  onCancelEdit,
  onSave,
  onStartEdit,
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
}: BinDetailToolbarProps) {
  const t = useTerminology();
  const { visible, animating, close, toggle } = usePopover();
  const wrapperRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapperRef, close);
  const { menuRef, onKeyDown: menuKeyDown } = useMenuKeyboard(visible, close);

  function handleItem(action: () => void) {
    close();
    action();
  }

  return (
    <div className="flex items-center gap-0.5 lg:gap-2">
      <MenuButton />
      {/* Desktop: nav arrows on the left */}
      {!editing && hasBinListContext && (
        <div className="hidden lg:flex gap-1.5 shrink-0">
          <Tooltip content="Previous" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev ?? undefined}
              disabled={!onPrev}
              aria-label="Previous bin"
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
          <Tooltip content="Next" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext ?? undefined}
              disabled={!onNext}
              aria-label="Next bin"
            >
              <ChevronRight className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
        </div>
      )}
      <div className="min-w-0 flex-1 flex justify-center">
        {editing ? (
          <input
            id="edit-name"
            value={editingName}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full bg-transparent text-[17px] font-semibold text-[var(--text-primary)] leading-tight border-b border-b-[var(--border-flat)] outline-none placeholder:text-[var(--text-tertiary)] p-0"
            placeholder="Name..."
          />
        ) : (
          <div className="row-tight min-w-0">
            <BinIcon className="hidden lg:block h-5 w-5 text-[var(--text-secondary)] shrink-0" />
            <span className="text-[17px] font-semibold text-[var(--text-primary)] leading-tight truncate">{bin.name}</span>
            {bin.visibility === 'private' && (
              <Lock className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
            )}
          </div>
        )}
      </div>
      {editing ? (
        <div className="flex gap-0.5 lg:gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancelEdit}
            className="lg:w-auto lg:px-3"
          >
            <X className="h-4 w-4 lg:hidden" />
            <span className="hidden lg:inline text-sm">Cancel</span>
          </Button>
          <Button
            size="icon"
            onClick={onSave}
            disabled={!editNameValid || isSaving}
            className="lg:w-auto lg:px-3"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 lg:hidden" />
                <Save className="h-4 w-4 mr-1.5 hidden lg:block" />
              </>
            )}
            <span className="hidden lg:inline text-sm">{isSaving ? 'Saving...' : 'Save'}</span>
          </Button>
        </div>
      ) : (
        <div className="flex gap-0.5 lg:gap-1.5 shrink-0">
          {canEdit && (
            <Tooltip content="Edit" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={onStartEdit}
                aria-label={`Edit ${t.bin}`}
              >
                <Pencil className="h-[18px] w-[18px]" />
              </Button>
            </Tooltip>
          )}
          {/* Desktop-only action buttons */}
          <div className="hidden lg:flex gap-1.5">
            {showAiButton && (
              <Tooltip content={isReanalysis ? 'Reanalyze with AI' : 'Analyze with AI'} side="bottom">
                <Button
                  size="icon"
                  onClick={onAnalyze}
                  disabled={isAnalyzing}
                  aria-label={isReanalysis ? 'Reanalyze with AI' : 'Analyze with AI'}
                  variant="ghost"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  ) : (
                    <Sparkles className="h-[18px] w-[18px]" />
                  )}
                </Button>
              </Tooltip>
            )}
            {canPin && (
              <Tooltip content={bin.is_pinned ? 'Unpin' : 'Pin'} side="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onTogglePin}
                  aria-label={bin.is_pinned ? `Unpin ${t.bin}` : `Pin ${t.bin}`}
                >
                  <Pin className="h-[18px] w-[18px]" fill={bin.is_pinned ? 'currentColor' : 'none'} />
                </Button>
              </Tooltip>
            )}
          </div>
          <div className="relative" ref={wrapperRef}>
            <Tooltip content="More" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label="More actions"
              >
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
                {/* Mobile-only: AI, Pin, Edit (hidden on desktop where they're inline) */}
                {showAiButton && (
                  <button
                    type="button"
                    className="lg:hidden w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-150 disabled:opacity-40"
                    onClick={() => handleItem(onAnalyze)}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="h-4 w-4 text-[var(--text-tertiary)] animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-[var(--text-tertiary)]" />
                    )}
                    {isReanalysis ? 'Reanalyze with AI' : 'Analyze with AI'}
                  </button>
                )}
                {canPin && (
                  <button
                    type="button"
                    className="lg:hidden w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
                    onClick={() => handleItem(onTogglePin)}
                  >
                    <Pin className="h-4 w-4 text-[var(--text-tertiary)]" fill={bin.is_pinned ? 'currentColor' : 'none'} />
                    {bin.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                )}
                {(showAiButton || canPin) && (
                  <div className="lg:hidden my-1 border-t border-[var(--border-flat)]" />
                )}
                {canEdit && (
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
                    onClick={() => handleItem(onDuplicate)}
                  >
                    <Copy className="h-4 w-4 text-[var(--text-tertiary)]" />
                    Duplicate
                  </button>
                )}
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
                  onClick={() => handleItem(onPrint)}
                >
                  <Printer className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Print Label
                </button>
                {canEdit && otherLocations.length > 0 && (
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
                    onClick={() => handleItem(onMove)}
                  >
                    <ArrowRightLeft className="h-4 w-4 text-[var(--text-tertiary)]" />
                    Move
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
                    onClick={() => handleItem(onChangeCode)}
                  >
                    <QrCode className="h-4 w-4 text-[var(--text-tertiary)]" />
                    Change Code
                  </button>
                )}
                {showShareButton && onShare && (
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
                    onClick={() => handleItem(onShare)}
                  >
                    <Share2 className="h-4 w-4 text-[var(--text-tertiary)]" />
                    Share
                  </button>
                )}
                {canDelete && (
                  <>
                    <div className="my-1 border-t border-[var(--border-flat)]" />
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--destructive)] hover:bg-[var(--bg-hover)] transition-colors duration-150"
                      onClick={() => handleItem(onDelete)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {/* Close — far right, matching dialog convention */}
          <Tooltip content="Close" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
