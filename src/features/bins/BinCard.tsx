import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Lock, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Highlight } from '@/components/ui/highlight';
import { cn, haptic } from '@/lib/utils';
import { resolveIcon } from '@/lib/iconMap';
import { useLongPress } from '@/lib/useLongPress';
import { getColorPreset } from '@/lib/colorPalette';
import { useTheme } from '@/lib/theme';
import { useTagStyle } from '@/features/tags/useTagStyle';
import type { Bin } from '@/types';

interface BinCardProps {
  bin: Bin;
  index?: number;
  onTagClick?: (tag: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, index: number, shiftKey: boolean) => void;
  searchQuery?: string;
  onPinToggle?: (id: string, pinned: boolean) => void;
}

export const BinCard = React.memo(function BinCard({ bin, index = 0, onTagClick, selectable, selected, onSelect, searchQuery = '', onPinToggle }: BinCardProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const getTagStyle = useTagStyle();
  const BinIcon = resolveIcon(bin.icon);
  const colorPreset = getColorPreset(bin.color);
  const colorBg = colorPreset ? (theme === 'dark' ? colorPreset.bgDark : colorPreset.bg) : undefined;
  // Override muted text/icon color for better contrast on colored backgrounds
  const mutedColor = colorPreset
    ? (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)')
    : undefined;

  const handleLongPress = useCallback(() => {
    if (!selectable) {
      haptic();
      onSelect?.(bin.id, index, false);
    }
  }, [selectable, onSelect, bin.id, index]);

  const { onTouchStart, onTouchEnd, onTouchMove, onContextMenu, didLongPress } = useLongPress(handleLongPress);

  function handleClick(e: React.MouseEvent) {
    if (didLongPress.current) return;
    if (selectable) {
      onSelect?.(bin.id, index, e.shiftKey);
    } else {
      navigate(`/bin/${bin.id}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onSelect?.(bin.id, index, false);
      } else {
        if (selectable) {
          onSelect?.(bin.id, index, false);
        } else {
          navigate(`/bin/${bin.id}`);
        }
      }
    }
  }

  function handleCheckboxClick(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect?.(bin.id, index, e.shiftKey);
  }

  const checkbox = (
    <div
      className={cn(
        'mt-0.5 h-[22px] w-[22px] shrink-0 rounded-full border-2 transition-all duration-200 flex items-center justify-center',
        selected
          ? 'bg-[var(--accent)] border-[var(--accent)]'
          : 'border-[var(--text-tertiary)]'
      )}
      style={!selected && mutedColor ? { borderColor: mutedColor } : undefined}
    >
      {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
    </div>
  );

  return (
    <div
      tabIndex={0}
      role="button"
      aria-selected={selectable ? selected : undefined}
      className={cn(
        'group glass-card rounded-[var(--radius-lg)] px-4 py-3.5 cursor-pointer transition-all duration-200 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] select-none',
        selected && 'ring-2 ring-[var(--accent)] scale-[0.97]',
        selectable && !selected && 'active:bg-[var(--bg-active)]'
      )}
      style={colorBg ? { backgroundColor: colorBg } : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-start gap-3">
        {selectable ? (
          checkbox
        ) : (
          /* Layered icon / hover-checkbox for desktop discovery */
          <div
            className="relative mt-0.5 h-[22px] w-[22px] shrink-0"
            onClick={handleCheckboxClick}
          >
            {/* Default icon — fades out on hover (hover:hover targets pointer devices only) */}
            <BinIcon
              className="absolute inset-0 h-5 w-5 text-[var(--text-tertiary)] transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-0"
              style={mutedColor ? { color: mutedColor } : undefined}
            />
            {/* Checkbox — hidden by default, revealed on hover for pointer devices */}
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100',
              )}
            >
              <div className="h-[22px] w-[22px] rounded-full border-2 border-[var(--text-tertiary)] flex items-center justify-center"
                style={mutedColor ? { borderColor: mutedColor } : undefined}
              />
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[15px] text-[var(--text-primary)] truncate leading-snug flex items-center gap-1.5">
            <Highlight text={bin.name} query={searchQuery} />
            {bin.visibility === 'private' && <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" style={mutedColor ? { color: mutedColor } : undefined} />}
          </h3>
          {bin.area_name && (
            <p className="text-[12px] text-[var(--text-tertiary)] truncate leading-relaxed" style={mutedColor ? { color: mutedColor } : undefined}>
              <Highlight text={bin.area_name} query={searchQuery} />
            </p>
          )}
          {bin.items.length > 0 && (
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)] line-clamp-1 leading-relaxed" style={mutedColor ? { color: mutedColor } : undefined}>
              <Highlight text={bin.items.map(i => i.name).join(', ')} query={searchQuery} />
            </p>
          )}
          {bin.tags.length > 0 && (
            <div className="flex gap-1.5 mt-2 overflow-hidden">
              {bin.tags.map((tag) => {
                return (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer text-[11px] hover:bg-[var(--bg-active)] transition-colors"
                    style={getTagStyle(tag)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!selectable) onTagClick?.(tag);
                    }}
                  >
                    {tag}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
        {onPinToggle && !selectable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPinToggle(bin.id, !bin.is_pinned);
            }}
            className={cn(
              'shrink-0 mt-0.5 p-1 rounded-full transition-all',
              bin.is_pinned
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-tertiary)] dark:text-[var(--text-secondary)] opacity-0 group-hover:opacity-100'
            )}
            aria-label={bin.is_pinned ? 'Unpin bin' : 'Pin bin'}
          >
            <Pin className="h-4 w-4" fill={bin.is_pinned ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.bin.id === next.bin.id &&
    prev.bin.name === next.bin.name &&
    prev.bin.area_id === next.bin.area_id &&
    prev.bin.area_name === next.bin.area_name &&
    prev.bin.items.length === next.bin.items.length &&
    prev.bin.items.every((item, i) => item.id === next.bin.items[i].id && item.name === next.bin.items[i].name) &&
    prev.bin.icon === next.bin.icon &&
    prev.bin.color === next.bin.color &&
    prev.bin.updated_at === next.bin.updated_at &&
    prev.bin.visibility === next.bin.visibility &&
    prev.bin.is_pinned === next.bin.is_pinned &&
    prev.selectable === next.selectable &&
    prev.selected === next.selected &&
    prev.index === next.index &&
    prev.onTagClick === next.onTagClick &&
    prev.onSelect === next.onSelect &&
    prev.onPinToggle === next.onPinToggle &&
    prev.searchQuery === next.searchQuery
  );
});
