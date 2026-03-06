import type { LucideIcon } from 'lucide-react';
import { ArrowRightLeft, Check, ChevronLeft, Copy, Loader2, Lock, MoreHorizontal, Pencil, Pin, Printer, Save, Sparkles, Trash2, X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@chakra-ui/react';
import { MenuButton } from '@/components/ui/menu-button';
import { Tooltip } from '@/components/ui/tooltip';
import { useTerminology } from '@/lib/terminology';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import type { Bin, Location } from '@/types';

interface BinDetailToolbarProps {
  bin: Bin;
  editing: boolean;
  canEdit: boolean;
  canDelete: boolean;
  binIcon: LucideIcon;
  editingName: string;
  onNameChange: (name: string) => void;
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
  binIcon: BinIcon,
  editingName,
  onNameChange,
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
      {!editing && (
        <Button
          variant="ghost"
          size="xs" px="0"
          onClick={onBack}
          aria-label="Go back"
          flexShrink={0} className="hidden lg:flex text-purple-600 dark:text-purple-400"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      {!editing && <BinIcon className="hidden lg:block h-5 w-5 text-gray-600 dark:text-gray-300 shrink-0" />}
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            id="edit-name"
            value={editingName}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full bg-transparent text-[17px] font-semibold  leading-tight border-b border-b-[var(--border-glass)] outline-none placeholder:text-gray-500 dark:placeholder:text-gray-400 p-0"
            placeholder="Name..."
          />
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[17px] font-semibold  leading-tight truncate">{bin.name}</span>
            {bin.visibility === 'private' && (
              <Lock className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
            )}
          </div>
        )}
      </div>
      {editing ? (
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelEdit}
          >
            <X className="h-4 w-4 lg:hidden" />
            <span className="hidden lg:inline text-sm">Cancel</span>
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={!editNameValid}
          >
            <Check className="h-4 w-4 lg:hidden" />
            <Save className="h-4 w-4 mr-1.5 hidden lg:block" />
            <span className="hidden lg:inline text-sm">Save</span>
          </Button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          {showAiButton && (
            <Tooltip content="Analyze with AI" side="bottom">
              <Button
                size="sm" px="0"
                onClick={onAnalyze}
                disabled={isAnalyzing}
                aria-label="Analyze with AI"
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
          <Tooltip content={bin.is_pinned ? 'Unpin' : 'Pin'} side="bottom">
            <Button
              variant="ghost"
              size="sm" px="0"
              onClick={onTogglePin}
              aria-label={bin.is_pinned ? `Unpin ${t.bin}` : `Pin ${t.bin}`}
            >
              <Pin className="h-[18px] w-[18px]" fill={bin.is_pinned ? 'currentColor' : 'none'} />
            </Button>
          </Tooltip>
          {canEdit && (
            <Tooltip content="Edit" side="bottom">
              <Button
                variant="ghost"
                size="sm" px="0"
                onClick={onStartEdit}
                aria-label={`Edit ${t.bin}`}
              >
                <Pencil className="h-[18px] w-[18px]" />
              </Button>
            </Tooltip>
          )}
          <div className="relative" ref={menuRef}>
            <Tooltip content="More" side="bottom">
              <Button
                variant="ghost"
                size="sm" px="0"
                onClick={toggle}
                aria-label="More actions"
              >
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </Button>
            </Tooltip>
            {visible && (
              <div className={`${animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter'} absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-[var(--radius-lg)] py-1 shadow-lg border border-[var(--border-glass)]`}>
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px]  hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors duration-150"
                  onClick={() => handleItem(onDuplicate)}
                >
                  <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  Duplicate
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px]  hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors duration-150"
                  onClick={() => handleItem(onPrint)}
                >
                  <Printer className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  Print Label
                </button>
                {otherLocations.length > 0 && (
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px]  hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors duration-150"
                    onClick={() => handleItem(onMove)}
                  >
                    <ArrowRightLeft className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    Move
                  </button>
                )}
                {canDelete && (
                  <>
                    <div className="my-1 border-t border-[var(--border-glass)]" />
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-red-500 dark:text-red-400 hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors duration-150"
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
