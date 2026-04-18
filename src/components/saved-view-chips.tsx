import { Bookmark, X } from 'lucide-react';
import type { SavedView } from '@/lib/savedViews';
import { cn } from '@/lib/utils';

interface SavedViewChipsProps {
  views: SavedView[];
  onApply: (view: SavedView) => void;
  onDelete: (viewId: string) => void;
  className?: string;
}

export function SavedViewChips({ views, onApply, onDelete, className }: SavedViewChipsProps) {
  if (views.length === 0) return null;

  return (
    <div className={cn('flex gap-2 overflow-x-auto scrollbar-hide pt-0.5', className)}>
      {views.map((view) => (
        // biome-ignore lint/a11y/useSemanticElements: container with nested interactive delete button cannot be a plain button
        <div
          key={view.id}
          role="button"
          tabIndex={0}
          aria-label={`Apply saved view: ${view.name}`}
          onClick={() => onApply(view)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onApply(view); } }}
          className="group/chip shrink-0 rounded-[var(--radius-md)] px-3 py-2 flex items-center gap-2 max-w-[200px] transition-colors duration-150 cursor-pointer bg-[var(--accent)]/18 [@media(hover:hover)]:hover:bg-[var(--accent)]/28"
        >
          <Bookmark className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
          <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{view.name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(view.id); }}
            className="ml-auto -mr-0.5 p-1.5 rounded-[var(--radius-lg)] hover:bg-[var(--bg-active)] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/chip:opacity-100 transition-opacity"
            aria-label={`Remove saved view ${view.name}`}
          >
            <X className="h-3 w-3 text-[var(--text-tertiary)]" />
          </button>
        </div>
      ))}
    </div>
  );
}
