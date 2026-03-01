import { Check, Lock } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Highlight } from '@/components/ui/highlight';
import { getPhotoThumbUrl } from '@/features/photos/usePhotos';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { resolveIcon } from '@/lib/iconMap';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';
import { computeBinCardStyles } from './binCardStyles';
import { areCommonBinCardPropsEqual } from './binMemoUtils';
import { useBinCardInteraction } from './useBinCardInteraction';
import type { FieldKey } from './useColumnVisibility';

interface BinCardProps {
  bin: Bin;
  index?: number;
  onTagClick?: (tag: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, index: number, shiftKey: boolean) => void;
  searchQuery?: string;
  isVisible?: (field: FieldKey) => boolean;
}

export const BinCard = React.memo(function BinCard({ bin, index = 0, onTagClick, selectable, selected, onSelect, searchQuery = '', isVisible }: BinCardProps) {
  const { theme } = useTheme();
  const getTagStyle = useTagStyle();
  const BinIcon = resolveIcon(bin.icon);

  const { renderProps, isPhoto, coverPhotoId, secondaryStyle, secondaryBorderStyle, iconStyle, nameStyle, tagDefaultStyle } =
    computeBinCardStyles(bin.color, bin.card_style, theme);

  const { handleClick, handleKeyDown, longPress } = useBinCardInteraction({ binId: bin.id, index, selectable, onSelect });

  // BinCard has extra shift+Enter logic for selection — override handleKeyDown
  function handleKeyDownWithShift(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onSelect?.(bin.id, index, false);
      } else {
        handleKeyDown(e);
      }
    }
  }

  // Tag overflow: measure which tags fit in one line, show +N for the rest
  const tagsRef = useRef<HTMLDivElement>(null);
  const [visibleTagCount, setVisibleTagCount] = useState(bin.tags.length);

  // Reset when tags change so we re-measure with all tags in DOM
  const tagsKey = bin.tags.join('\0');
  const prevTagsKeyRef = useRef(tagsKey);
  if (prevTagsKeyRef.current !== tagsKey) {
    prevTagsKeyRef.current = tagsKey;
    setVisibleTagCount(bin.tags.length);
  }

  // Measure which tags fit before browser paint
  useLayoutEffect(() => {
    const el = tagsRef.current;
    if (!el || bin.tags.length === 0 || visibleTagCount !== bin.tags.length) return;
    const children = Array.from(el.children) as HTMLElement[];
    if (children.length === 0) return;
    const containerRight = el.getBoundingClientRect().right;
    // All tags fit?
    if (children[children.length - 1].getBoundingClientRect().right <= containerRight + 1) return;
    // Find how many fit, reserving ~42px for the +N badge (36px badge + 6px gap)
    let count = 0;
    for (let i = 0; i < bin.tags.length && i < children.length; i++) {
      if (children[i].getBoundingClientRect().right <= containerRight - 42 + 1) {
        count++;
      } else break;
    }
    setVisibleTagCount(Math.max(1, count));
  }, [bin.tags, visibleTagCount]);

  // Re-measure when container width changes (window resize, layout shift)
  const tagsLenRef = useRef(bin.tags.length);
  tagsLenRef.current = bin.tags.length;
  useEffect(() => {
    const el = tagsRef.current;
    if (!el) return;
    let prevWidth = el.clientWidth;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (Math.abs(w - prevWidth) > 1) {
        prevWidth = w;
        setVisibleTagCount(tagsLenRef.current);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hiddenTagCount = bin.tags.length - visibleTagCount;
  const displayedTags = hiddenTagCount > 0 ? bin.tags.slice(0, visibleTagCount) : bin.tags;

  function handleCheckboxClick(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect?.(bin.id, index, e.shiftKey);
  }

  const checkbox = (
    <div
      className={cn(
        'mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 transition-all duration-200 flex items-center justify-center',
        selected
          ? 'bg-[var(--accent)] border-[var(--accent)]'
          : 'border-[var(--text-tertiary)]'
      )}
      style={!selected ? secondaryBorderStyle : undefined}
    >
      {selected && <Check className="h-3 w-3 text-white animate-check-pop" strokeWidth={3} />}
    </div>
  );

  const cardContent = (
    <div className="flex items-start gap-3 h-full">
      <div className="min-w-0 flex-1 flex flex-col self-stretch">
        <h3
          className="font-semibold text-[15px] text-[var(--text-primary)] leading-snug flex items-center gap-1.5 min-w-0 overflow-hidden"
        >
          <span className="truncate" style={nameStyle}>
            <Highlight text={bin.name} query={searchQuery} />
          </span>
          {bin.visibility === 'private' && (
            <Lock
              className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
              style={secondaryStyle}
            />
          )}
        </h3>
        {isVisible?.('area') !== false && bin.area_name && (
          <p
            className="text-[12px] text-[var(--text-tertiary)] truncate leading-relaxed"
            style={secondaryStyle}
          >
            <Highlight text={bin.area_name} query={searchQuery} />
          </p>
        )}
        {isVisible?.('items') !== false && bin.items.length > 0 && (
          <p
            className="mt-1 text-[13px] text-[var(--text-tertiary)] line-clamp-1 leading-relaxed"
            style={secondaryStyle}
          >
            <Highlight text={bin.items.map(i => i.name).join(', ')} query={searchQuery} />
          </p>
        )}
        {isVisible?.('notes') && bin.notes && (
          <p
            className="mt-1 text-[13px] text-[var(--text-tertiary)] line-clamp-1 leading-relaxed italic"
            style={secondaryStyle}
          >
            <Highlight text={bin.notes} query={searchQuery} />
          </p>
        )}
        {isVisible?.('tags') !== false && bin.tags.length > 0 && (
          <div ref={tagsRef} className="flex flex-nowrap gap-1.5 mt-auto pt-2 overflow-hidden items-center">
            {displayedTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="shrink-0 max-w-[8rem] truncate cursor-pointer text-[11px] hover:bg-[var(--bg-active)] transition-colors"
                style={isPhoto
                  ? { backgroundColor: 'rgba(0,0,0,0.4)', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }
                  : getTagStyle(tag) ?? tagDefaultStyle
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (!selectable) onTagClick?.(tag);
                }}
              >
                {tag}
              </Badge>
            ))}
            {hiddenTagCount > 0 && (
              <Badge
                variant="secondary"
                className="shrink-0 text-[11px] opacity-70"
                style={isPhoto
                  ? { backgroundColor: 'rgba(0,0,0,0.4)', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }
                  : tagDefaultStyle
                }
              >
                +{hiddenTagCount}
              </Badge>
            )}
          </div>
        )}
      </div>
      {selectable ? (
        checkbox
      ) : onSelect ? (
        /* Layered icon / hover-checkbox for desktop discovery */
        <button
          type="button"
          tabIndex={0}
          className="relative mt-0.5 h-5 w-5 shrink-0 appearance-none bg-transparent border-none p-0"
          onClick={handleCheckboxClick}
          aria-label="Select"
        >
          {/* Default icon — fades out on hover (hover:hover targets pointer devices only) */}
          {isVisible?.('icon') !== false && (
            <BinIcon
              className="absolute inset-0 h-5 w-5 text-[var(--text-tertiary)] transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-0"
              style={iconStyle}
            />
          )}
          {/* Checkbox — hidden by default, revealed on hover for pointer devices */}
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100',
            )}
          >
            <div className="h-5 w-5 rounded-full border-2 border-[var(--text-tertiary)] flex items-center justify-center"
              style={secondaryBorderStyle}
            />
          </div>
        </button>
      ) : isVisible?.('icon') !== false ? (
        <BinIcon
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-tertiary)]"
          style={iconStyle}
        />
      ) : null}
    </div>
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: custom card with complex layout cannot be a plain button
    <div
      tabIndex={0}
      role="button"
      aria-pressed={selectable ? selected : undefined}
      className={cn(
        'group h-full rounded-[var(--radius-lg)] px-4 py-3.5 cursor-pointer transition-all duration-200 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] select-none [@media(hover:hover)]:hover:scale-[1.02] [@media(hover:hover)]:hover:shadow-[var(--shadow-elevated)] [@media(hover:hover)]:hover:-translate-y-0.5 animate-stagger-in',
        renderProps.className,
        selected && 'ring-2 ring-[var(--accent)] scale-[0.97]',
        selectable && !selected && 'active:bg-[var(--bg-active)]'
      )}
      style={{ ...renderProps.style, animationDelay: `${Math.min(index * 30, 300)}ms` }}
      onClick={handleClick}
      onKeyDown={handleKeyDownWithShift}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
      onContextMenu={longPress.onContextMenu}
    >
      {renderProps.stripeBar && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            background: renderProps.stripeBar.color,
            ...(renderProps.stripeBar.position === 'left' && { left: 0, top: 0, bottom: 0, width: renderProps.stripeBar.width }),
            ...(renderProps.stripeBar.position === 'right' && { right: 0, top: 0, bottom: 0, width: renderProps.stripeBar.width }),
            ...(renderProps.stripeBar.position === 'top' && { left: 0, top: 0, right: 0, height: renderProps.stripeBar.width }),
            ...(renderProps.stripeBar.position === 'bottom' && { left: 0, bottom: 0, right: 0, height: renderProps.stripeBar.width }),
          }}
        />
      )}
      {isPhoto && coverPhotoId ? (
        <>
          {/* Background image */}
          <img
            src={getPhotoThumbUrl(coverPhotoId)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          {/* Dark scrim overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-black/10" />
          {/* Content on top */}
          <div className="relative z-10 h-full">
            {cardContent}
          </div>
        </>
      ) : (
        cardContent
      )}
    </div>
  );
}, (prev, next) => {
  return (
    areCommonBinCardPropsEqual(prev, next) &&
    prev.onTagClick === next.onTagClick
  );
});
