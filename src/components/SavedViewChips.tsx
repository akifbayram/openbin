import { Bookmark, X } from 'lucide-react';
import type { SavedView } from '@/lib/savedViews';

interface SavedViewChipsProps {
  views: SavedView[];
  onApply: (view: SavedView) => void;
  onDelete: (viewId: string) => void;
}

export function SavedViewChips({ views, onApply, onDelete }: SavedViewChipsProps) {
  if (views.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">
        Saved Searches
      </h2>
      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5 pt-1 pb-3">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => onApply(view)}
            className="group/chip shrink-0 glass-card rounded-[var(--radius-lg)] px-3.5 py-2.5 flex items-center gap-2.5 max-w-[200px] active:scale-[0.98] transition-all"
          >
            <Bookmark className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
            <span className="text-[14px] font-medium text-[var(--text-primary)] truncate">{view.name}</span>
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onDelete(view.id); }}
              className="ml-auto p-0.5 rounded-full hover:bg-[var(--bg-active)] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/chip:opacity-100 transition-opacity"
              aria-label={`Remove saved view ${view.name}`}
            >
              <X className="h-3 w-3 text-[var(--text-tertiary)]" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
