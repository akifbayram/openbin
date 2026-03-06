import { ChevronDown, ChevronUp, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { OptionGroup } from '@/components/ui/option-group';
import { getPhotoThumbUrl } from '@/features/photos/usePhotos';
import type { BorderStyle, BorderWidth, CardStyle, CardStyleVariant, StripePosition, StripeWidth } from '@/lib/cardStyle';
import { parseCardStyle, serializeCardStyle } from '@/lib/cardStyle';
import { PREMADE_BACKGROUNDS } from '@/lib/premadeBackgrounds';
import { cn } from '@/lib/utils';
import type { Photo } from '@/types';

interface StylePickerProps {
  value: string; // raw card_style JSON string
  color: string;
  onChange: (cardStyle: string) => void;
  /** Available photos for the photo variant (only when editing existing bin) */
  photos?: Photo[];
}

const VARIANTS: { key: CardStyleVariant; label: string }[] = [
  { key: 'glass', label: 'Glass' },
  { key: 'border', label: 'Border' },
  { key: 'gradient', label: 'Gradient' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'photo', label: 'Photo' },
];

const STRIPE_POSITIONS: { key: StripePosition; label: string }[] = [
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
  { key: 'top', label: 'Top' },
  { key: 'bottom', label: 'Bottom' },
];

const STRIPE_WIDTHS: StripeWidth[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const BORDER_WIDTHS: BorderWidth[] = ['1', '2', '3', '4', '5', '6', '7', '8'];
const BORDER_STYLES: { key: BorderStyle; label: string }[] = [
  { key: 'solid', label: 'Solid' },
  { key: 'dashed', label: 'Dashed' },
  { key: 'dotted', label: 'Dotted' },
  { key: 'double', label: 'Double' },
];

function VariantPreview({ variant, rectangular }: { variant: CardStyleVariant; rectangular?: boolean }) {
  const baseClass = cn(rectangular ? 'aspect-[16/9]' : 'aspect-square', 'w-full rounded-[var(--radius-sm)] transition-all');

  if (variant === 'glass') {
    return <div className={cn(baseClass, 'glass-card')} />;
  }
  if (variant === 'border') {
    return <div className={cn(baseClass, 'border-4 border-purple-600 dark:border-purple-500')} />;
  }
  if (variant === 'gradient') {
    return (
      <div
        className={cn(baseClass, 'bg-gradient-to-br from-purple-600 dark:from-purple-500 to-transparent')}
      />
    );
  }
  if (variant === 'stripe') {
    return <div className={cn(baseClass, 'glass-card border-l-[6px] border-l-purple-600 dark:border-l-purple-500')} />;
  }
  if (variant === 'photo') {
    return (
      <div className={cn(baseClass, 'bg-gray-200 dark:bg-gray-900 flex items-center justify-center')}>
        <ImageIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </div>
    );
  }
  return <div className={cn(baseClass, 'glass-card')} />;
}

export function StylePicker({ value, color: _color, onChange, photos }: StylePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseCardStyle(value);
  const currentVariant = parsed?.variant ?? 'glass';
  const displayLabel = VARIANTS.find((v) => v.key === currentVariant)?.label ?? 'Glass';
  const hasPhotos = photos && photos.length > 0;

  function updateStyle(patch: Partial<CardStyle>) {
    onChange(serializeCardStyle({ ...parsed, ...patch } as CardStyle));
  }

  function selectVariant(variant: CardStyleVariant) {
    if (variant === 'glass') {
      onChange('');
    } else if (variant === 'photo') {
      const existingAssetId = parsed?.coverAssetId;
      const existingPhotoId = parsed?.coverPhotoId;
      if (existingAssetId || existingPhotoId) {
        onChange(serializeCardStyle({ variant: 'photo', coverAssetId: existingAssetId, coverPhotoId: existingPhotoId }));
      } else if (hasPhotos) {
        onChange(serializeCardStyle({ variant: 'photo', coverPhotoId: photos?.[0].id }));
      } else {
        onChange(serializeCardStyle({ variant: 'photo', coverAssetId: PREMADE_BACKGROUNDS[0]?.id }));
      }
    } else {
      onChange(serializeCardStyle({ ...parsed, variant, secondaryColor: parsed?.secondaryColor }));
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px]  hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors border border-black/6 dark:border-white/6"
      >
        <div className="w-4 h-4 shrink-0">
          <VariantPreview variant={currentVariant} />
        </div>
        <span className="flex-1 text-left">{displayLabel}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
      </button>
      {open && (
        <div className="space-y-3 p-3 rounded-[var(--radius-sm)] border border-black/6 dark:border-white/6 bg-white/70 dark:bg-gray-800/70">
          {/* Variant buttons */}
          <OptionGroup
            options={VARIANTS.map((v) => ({
              ...v,
            }))}
            value={currentVariant}
            onChange={selectVariant}
            size="sm"
            renderContent={(opt) => (
              <div className="flex flex-col items-center gap-1 text-[11px]">
                <VariantPreview variant={opt.key as CardStyleVariant} rectangular />
                {opt.label}
              </div>
            )}
          />

          {/* Outline non-color controls */}
          {currentVariant === 'border' && (
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Border Style</p>
                <OptionGroup
                  options={BORDER_STYLES}
                  value={(parsed?.borderStyle ?? 'solid') as BorderStyle}
                  onChange={(borderStyle) => updateStyle({ borderStyle })}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Thickness</p>
                <OptionGroup
                  options={BORDER_WIDTHS.map((w) => ({ key: w, label: `${w}px` }))}
                  value={(parsed?.borderWidth ?? '2') as BorderWidth}
                  onChange={(borderWidth) => updateStyle({ borderWidth })}
                  size="sm"
                />
              </div>
            </div>
          )}

          {/* Stripe non-color controls */}
          {currentVariant === 'stripe' && (
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Position</p>
                <OptionGroup
                  options={STRIPE_POSITIONS}
                  value={(parsed?.stripePosition ?? 'left') as StripePosition}
                  onChange={(stripePosition) => updateStyle({ stripePosition })}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Thickness</p>
                <OptionGroup
                  options={STRIPE_WIDTHS.map((w) => ({ key: w, label: `${w}px` }))}
                  value={(parsed?.stripeWidth ?? '4') as StripeWidth}
                  onChange={(stripeWidth) => updateStyle({ stripeWidth: stripeWidth === '4' ? undefined : stripeWidth })}
                  size="sm"
                />
              </div>
            </div>
          )}

          {/* Premade + photo selectors */}
          {currentVariant === 'photo' && (
            <div className="space-y-3">
              {/* Premade backgrounds — always visible when assets have src */}
              {PREMADE_BACKGROUNDS.some((bg) => bg.src) && (
                <div className="space-y-1.5">
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">Backgrounds</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PREMADE_BACKGROUNDS.filter((bg) => bg.src).map((bg) => {
                      const isSelected = parsed?.coverAssetId === bg.id;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() => onChange(serializeCardStyle({ variant: 'photo', coverAssetId: bg.id }))}
                          className={cn(
                            'relative aspect-[16/9] rounded-[var(--radius-sm)] overflow-hidden transition-all',
                            isSelected
                              ? 'ring-2 ring-purple-600 dark:ring-purple-500 ring-offset-1 ring-offset-white/70 dark:ring-offset-gray-800/70'
                              : 'hover:opacity-80'
                          )}
                          title={bg.label}
                        >
                          <img
                            src={bg.src}
                            alt={bg.label}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* User-uploaded photos */}
              {hasPhotos && (
                <div className="space-y-1.5">
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">Your photos</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {photos?.map((photo) => {
                      const isSelected = !parsed?.coverAssetId && parsed?.coverPhotoId === photo.id;
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => onChange(serializeCardStyle({ variant: 'photo', coverPhotoId: photo.id }))}
                          className={cn(
                            'relative aspect-[16/9] rounded-[var(--radius-sm)] overflow-hidden transition-all',
                            isSelected
                              ? 'ring-2 ring-purple-600 dark:ring-purple-500 ring-offset-1 ring-offset-white/70 dark:ring-offset-gray-800/70'
                              : 'hover:opacity-80'
                          )}
                        >
                          <img
                            src={getPhotoThumbUrl(photo.id)}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
