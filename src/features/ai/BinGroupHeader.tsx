import { ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BinGroupHeaderProps {
  name: string;
  areaName: string;
  icon: string;
  color: string;
  isTrashed: boolean;
  onOpen: () => void;
}

export function BinGroupHeader({
  name,
  areaName,
  icon,
  color,
  isTrashed,
  onOpen,
}: BinGroupHeaderProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-trashed={isTrashed ? 'true' : undefined}
      aria-label={`Open ${name}`}
      className={cn(
        'w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-[var(--bg-active)] transition-colors rounded-t-[var(--radius-sm)]',
        isTrashed && 'opacity-70',
      )}
    >
      {isTrashed ? (
        <Trash2 className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
      ) : (
        <span
          aria-hidden
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-[13px]"
          style={{ background: color }}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-medium text-[var(--text-primary)] truncate">{name}</span>
        {areaName && (
          <span className="block text-[12px] text-[var(--text-tertiary)]">{areaName}</span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
    </button>
  );
}
