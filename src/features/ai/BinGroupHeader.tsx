import { ChevronRight, Trash2 } from 'lucide-react';
import { BinIconBadge } from '@/components/ui/bin-icon-badge';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
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
  const BinIcon = resolveIcon(icon);
  const colorPreset = resolveColor(color);

  return (
    <button
      type="button"
      onClick={onOpen}
      data-trashed={isTrashed ? 'true' : undefined}
      aria-label={`Open ${name}`}
      className={cn(
        'w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-active)] transition-colors rounded-t-[var(--radius-sm)]',
        isTrashed && 'opacity-70',
      )}
    >
      {isTrashed ? (
        <Trash2 className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
      ) : (
        <BinIconBadge icon={BinIcon} colorPreset={colorPreset} />
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-[var(--text-primary)] truncate">{name}</span>
        {areaName && (
          <span className="block text-[12px] text-[var(--text-tertiary)] mt-0.5">{areaName}</span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
    </button>
  );
}
