import { Check, Lock } from 'lucide-react';
import React from 'react';
import { Highlight } from '@/components/ui/highlight';
import { getPhotoThumbUrl } from '@/features/photos/usePhotos';
import { resolveIcon } from '@/lib/iconMap';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';
import { computeBinCardStyles } from './binCardStyles';
import { areCommonBinCardPropsEqual } from './binMemoUtils';
import { useBinCardInteraction } from './useBinCardInteraction';
import type { FieldKey } from './useColumnVisibility';

interface BinCompactCardProps {
  bin: Bin;
  index: number;
  onTagClick?: (tag: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, index: number, shiftKey: boolean) => void;
  searchQuery?: string;
  isVisible?: (field: FieldKey) => boolean;
}

export const BinCompactCard = React.memo(function BinCompactCard({
  bin,
  index,
  selectable,
  selected,
  onSelect,
  searchQuery = '',
  isVisible,
}: BinCompactCardProps) {
  const { theme } = useTheme();
  const BinIcon = resolveIcon(bin.icon);

  const { renderProps, isPhoto, coverPhotoId, secondaryStyle, secondaryBorderStyle, iconStyle, nameStyle } =
    computeBinCardStyles(bin.color, bin.card_style, theme);

  const { handleClick, handleKeyDown, longPress } = useBinCardInteraction({ binId: bin.id, index, selectable, onSelect });

  const checkbox = (
    <div
      className={cn(
        'mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 transition-all duration-200 flex items-center justify-center',
        selected
          ? 'bg-[var(--accent)] border-[var(--accent)]'
          : 'border-[var(--text-tertiary)]',
      )}
      style={!selected ? secondaryBorderStyle : undefined}
    >
      {selected && <Check className="h-3 w-3 text-white animate-check-pop" strokeWidth={3} />}
    </div>
  );

  const cardContent = (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <h3
          className="font-semibold text-[13px] text-[var(--text-primary)] truncate leading-snug flex items-center gap-1"
          style={nameStyle}
        >
          <Highlight text={bin.name} query={searchQuery} />
          {bin.visibility === 'private' && (
            <Lock className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" style={secondaryStyle} />
          )}
        </h3>
        {isVisible?.('area') && bin.area_name && (
          <p className="text-[11px] text-[var(--text-tertiary)] truncate leading-relaxed" style={secondaryStyle}>
            <Highlight text={bin.area_name} query={searchQuery} />
          </p>
        )}
      </div>

      {/* Icon / checkbox */}
      {selectable ? (
        checkbox
      ) : onSelect ? (
        <button
          type="button"
          tabIndex={0}
          className="relative mt-0.5 h-5 w-5 shrink-0 appearance-none bg-transparent border-none p-0"
          onClick={(e) => { e.stopPropagation(); onSelect(bin.id, index, e.shiftKey); }}
          aria-label="Select"
        >
          {isVisible?.('icon') !== false && (
            <BinIcon
              className="absolute inset-0 h-5 w-5 text-[var(--text-tertiary)] transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-0"
              style={iconStyle}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100">
            <div className="h-5 w-5 rounded-full border-2 border-[var(--text-tertiary)] flex items-center justify-center"
              style={secondaryBorderStyle}
            />
          </div>
        </button>
      ) : isVisible?.('icon') !== false ? (
        <BinIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" style={iconStyle} />
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
        'group rounded-[var(--radius-md)] px-3 py-2.5 cursor-pointer transition-all duration-200 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] select-none [@media(hover:hover)]:hover:scale-[1.02] [@media(hover:hover)]:hover:shadow-[var(--shadow-elevated)] [@media(hover:hover)]:hover:-translate-y-0.5 animate-stagger-in',
        renderProps.className,
        selected && 'ring-2 ring-[var(--accent)] scale-[0.97]',
        selectable && !selected && 'active:bg-[var(--bg-active)]',
      )}
      style={{ ...renderProps.style, animationDelay: `${Math.min(index * 20, 300)}ms` }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
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
          <img
            src={getPhotoThumbUrl(coverPhotoId)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-black/10" />
          <div className="relative z-10">{cardContent}</div>
        </>
      ) : (
        cardContent
      )}
    </div>
  );
}, (prev, next) => {
  return areCommonBinCardPropsEqual(prev, next);
});
