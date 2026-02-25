import { useRef } from 'react';
import { ChevronLeft, Pencil, Trash2, Printer, Save, Sparkles, Loader2, Pin, ArrowRightLeft, Copy, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useTerminology } from '@/lib/terminology';
import { MenuButton } from '@/components/ui/menu-button';
import { usePopover } from '@/lib/usePopover';
import { useClickOutside } from '@/lib/useClickOutside';
import type { Bin, Location } from '@/types';

interface BinDetailToolbarProps {
  bin: Bin;
  editing: boolean;
  canEdit: boolean;
  canDelete: boolean;
  backLabel: string;
  showAiButton: boolean;
  isAnalyzing: boolean;
  editNameValid: boolean;
  otherLocations: Location[];
  onBack: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onStartEdit: () => void;
  onAnalyze: () => void;
  onTogglePin: () => void;
  onPrint: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
}

export function BinDetailToolbar({
  bin,
  editing,
  canEdit,
  canDelete,
  backLabel,
  showAiButton,
  isAnalyzing,
  editNameValid,
  otherLocations,
  onBack,
  onCancelEdit,
  onSave,
  onStartEdit,
  onAnalyze,
  onTogglePin,
  onPrint,
  onDuplicate,
  onMove,
  onDelete,
}: BinDetailToolbarProps) {
  const t = useTerminology();
  const { visible, animating, close, toggle } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, close);

  function handleItem(action: () => void) {
    close();
    action();
  }

  return (
    <div className="flex items-center gap-2">
      <MenuButton />
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="rounded-[var(--radius-full)] gap-0.5 pl-1.5 pr-3 text-[var(--accent)]"
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="text-[15px]">{backLabel}</span>
      </Button>
      <div className="flex-1" />
      {editing ? (
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelEdit}
            className="rounded-[var(--radius-full)]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={!editNameValid}
            className="rounded-[var(--radius-full)]"
          >
            <Save className="h-4 w-4 mr-1.5" />
            Save
          </Button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          {showAiButton && (
            <Tooltip content="Analyze with AI" side="bottom">
              <Button
                size="icon"
                onClick={onAnalyze}
                disabled={isAnalyzing}
                aria-label="Analyze with AI"
                variant="ghost"
                className="rounded-full h-9 w-9"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <Sparkles className="h-[18px] w-[18px]" />
                )}
              </Button>
            </Tooltip>
          )}
          <Tooltip content={bin.is_pinned ? 'Unpin' : 'Pin'} side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={onTogglePin}
              aria-label={bin.is_pinned ? `Unpin ${t.bin}` : `Pin ${t.bin}`}
              className="rounded-full h-9 w-9"
            >
              <Pin className="h-[18px] w-[18px]" fill={bin.is_pinned ? 'currentColor' : 'none'} />
            </Button>
          </Tooltip>
          {canEdit && (
            <Tooltip content="Edit" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={onStartEdit}
                aria-label={`Edit ${t.bin}`}
                className="rounded-full h-9 w-9"
              >
                <Pencil className="h-[18px] w-[18px]" />
              </Button>
            </Tooltip>
          )}
          <div className="relative" ref={menuRef}>
            <Tooltip content="More" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label="More actions"
                className="rounded-full h-9 w-9"
              >
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </Button>
            </Tooltip>
            {visible && (
              <div className={`${animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter'} absolute right-0 top-full mt-1.5 z-50 min-w-[180px] glass-heavy rounded-[var(--radius-lg)] py-1 shadow-lg border border-[var(--border-glass)]`}>
                <button
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => handleItem(onDuplicate)}
                >
                  <Copy className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Duplicate
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => handleItem(onPrint)}
                >
                  <Printer className="h-4 w-4 text-[var(--text-tertiary)]" />
                  Print Label
                </button>
                {otherLocations.length > 0 && (
                  <button
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    onClick={() => handleItem(onMove)}
                  >
                    <ArrowRightLeft className="h-4 w-4 text-[var(--text-tertiary)]" />
                    Move
                  </button>
                )}
                {canDelete && (
                  <>
                    <div className="my-1 border-t border-[var(--border-glass)]" />
                    <button
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--destructive)] hover:bg-[var(--bg-hover)] transition-colors"
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
        </div>
      )}
    </div>
  );
}
