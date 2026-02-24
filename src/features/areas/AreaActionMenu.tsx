import { Pencil, Trash2 } from 'lucide-react';

interface AreaActionMenuProps {
  open: boolean;
  onRename: () => void;
  onDelete: () => void;
}

export function AreaActionMenu({ open, onRename, onDelete }: AreaActionMenuProps) {
  if (!open) return null;
  return (
    <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[140px] glass-heavy rounded-[var(--radius-lg)] shadow-lg border border-[var(--border-glass)] overflow-hidden">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRename(); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Pencil className="h-4 w-4" />
        Rename
      </button>
      <div className="my-1 border-t border-[var(--border-glass)]" />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--destructive)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
}
