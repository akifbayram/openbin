import { ChevronLeft, Pencil, Trash2, Printer, Save, Sparkles, Loader2, Pin, ArrowRightLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useTerminology } from '@/lib/terminology';
import { MenuButton } from '@/components/ui/menu-button';
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
          <Tooltip content="Print label" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrint}
              aria-label="Print label"
              className="rounded-full h-9 w-9"
            >
              <Printer className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
          <Tooltip content="Duplicate" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={onDuplicate}
              aria-label={`Duplicate ${t.bin}`}
              className="rounded-full h-9 w-9"
            >
              <Copy className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
          {otherLocations.length > 0 && (
            <Tooltip content="Move" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={onMove}
                aria-label={`Move ${t.bin}`}
                className="rounded-full h-9 w-9"
              >
                <ArrowRightLeft className="h-[18px] w-[18px]" />
              </Button>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip content="Delete" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                aria-label={`Delete ${t.bin}`}
                className="rounded-full h-9 w-9 text-[var(--destructive)]"
              >
                <Trash2 className="h-[18px] w-[18px]" />
              </Button>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
