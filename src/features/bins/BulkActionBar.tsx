import { CheckCircle2, Tag, MapPin, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BulkActionBarProps {
  selectedCount: number;
  onTag: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionBar({ selectedCount, onTag, onMove, onDelete, onClear }: BulkActionBarProps) {
  return (
    <div className="glass-card rounded-[var(--radius-full)] flex items-center gap-2 px-4 py-2.5">
      <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
      <span className="text-[13px] font-medium text-[var(--text-secondary)] flex-1">
        {selectedCount} selected
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-3 rounded-[var(--radius-full)]"
        onClick={onTag}
      >
        <Tag className="h-3.5 w-3.5 mr-1.5" />
        Tag
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-3 rounded-[var(--radius-full)]"
        onClick={onMove}
      >
        <MapPin className="h-3.5 w-3.5 mr-1.5" />
        Move
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-3 rounded-[var(--radius-full)] text-[var(--destructive)]"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
        Delete
      </Button>
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
  );
}
