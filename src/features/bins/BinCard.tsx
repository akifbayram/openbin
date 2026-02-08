import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Highlight } from '@/components/ui/highlight';
import { cn, haptic } from '@/lib/utils';
import { resolveIcon } from '@/lib/iconMap';
import { getColorPreset } from '@/lib/colorPalette';
import { useTheme } from '@/lib/theme';
import type { Bin } from '@/types';

interface BinCardProps {
  bin: Bin;
  onTagClick?: (tag: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  searchQuery?: string;
}

export const BinCard = React.memo(function BinCard({ bin, onTagClick, selectable, selected, onSelect, searchQuery = '' }: BinCardProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const BinIcon = resolveIcon(bin.icon);
  const colorPreset = getColorPreset(bin.color);
  const colorBg = colorPreset ? (theme === 'dark' ? colorPreset.bgDark : colorPreset.bg) : undefined;

  function handleClick() {
    if (selectable) {
      onSelect?.(bin.id);
    } else {
      navigate(`/bin/${bin.id}`);
    }
  }

  function handleLongPress() {
    if (!selectable) {
      haptic();
      onSelect?.(bin.id);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (e.shiftKey && selectable) {
        onSelect?.(bin.id);
      } else if (e.shiftKey) {
        onSelect?.(bin.id);
      } else {
        handleClick();
      }
    }
  }

  return (
    <div
      tabIndex={0}
      role="button"
      aria-selected={selectable ? selected : undefined}
      className={cn(
        'glass-card rounded-[var(--radius-lg)] px-4 py-3.5 cursor-pointer transition-all duration-200 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        selected && 'ring-2 ring-[var(--accent)]',
        selectable && !selected && 'active:bg-[var(--bg-active)]'
      )}
      style={colorBg ? { backgroundColor: colorBg } : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
    >
      <div className="flex items-start gap-3">
        {selectable ? (
          <div
            className={cn(
              'mt-0.5 h-[22px] w-[22px] shrink-0 rounded-full border-2 transition-all duration-200 flex items-center justify-center',
              selected
                ? 'bg-[var(--accent)] border-[var(--accent)]'
                : 'border-[var(--text-tertiary)]'
            )}
          >
            {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
          </div>
        ) : (
          <BinIcon className="h-5 w-5 mt-0.5 text-[var(--text-tertiary)] shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[15px] text-[var(--text-primary)] truncate leading-snug">
            <Highlight text={bin.name} query={searchQuery} />
          </h3>
          {bin.items.length > 0 && (
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)] line-clamp-1 leading-relaxed">
              <Highlight text={bin.items.join(', ')} query={searchQuery} />
            </p>
          )}
          {bin.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {bin.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer text-[11px] hover:bg-[var(--bg-active)] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!selectable) onTagClick?.(tag);
                  }}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.bin.id === next.bin.id &&
    prev.bin.name === next.bin.name &&
    prev.bin.items.length === next.bin.items.length &&
    prev.bin.items.every((item, i) => item === next.bin.items[i]) &&
    prev.bin.icon === next.bin.icon &&
    prev.bin.color === next.bin.color &&
    prev.bin.updatedAt === next.bin.updatedAt &&
    prev.selectable === next.selectable &&
    prev.selected === next.selected &&
    prev.onTagClick === next.onTagClick &&
    prev.onSelect === next.onSelect &&
    prev.searchQuery === next.searchQuery
  );
});
