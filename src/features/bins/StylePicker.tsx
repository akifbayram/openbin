import { useState } from 'react';
import { ChevronDown, ChevronUp, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPhotoThumbUrl } from '@/features/photos/usePhotos';
import type { CardStyleVariant, CardStyle, StripePosition, BorderStyle, BorderWidth, StripeWidth } from '@/lib/cardStyle';
import { parseCardStyle, serializeCardStyle } from '@/lib/cardStyle';
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

function OptionGroup<K extends string>({
  options,
  value,
  onChange,
  gap = 'gap-1.5',
  renderLabel,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  gap?: string;
  renderLabel?: (opt: { key: K; label: string }) => string;
}) {
  return (
    <div className={cn('flex', gap)}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            'flex-1 py-1 rounded-full text-[12px] font-medium transition-colors',
            value === opt.key
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          )}
        >
          {renderLabel ? renderLabel(opt) : opt.label}
        </button>
      ))}
    </div>
  );
}

function VariantPreview({ variant, color }: { variant: CardStyleVariant; color: string }) {
  const baseClass = 'aspect-square w-full rounded-[4px] transition-all';

  if (variant === 'glass') {
    return <div className={cn(baseClass, 'glass-card')} />;
  }
  if (variant === 'border') {
    return <div className={cn(baseClass, 'border-2')} style={{ borderColor: color ? `var(--accent)` : 'var(--border)' }} />;
  }
  if (variant === 'gradient') {
    return (
      <div
        className={baseClass}
        style={{ background: 'linear-gradient(135deg, var(--accent), transparent)' }}
      />
    );
  }
  if (variant === 'stripe') {
    return <div className={cn(baseClass, 'glass-card')} style={{ borderLeft: '4px solid var(--accent)' }} />;
  }
  if (variant === 'photo') {
    return (
      <div className={cn(baseClass, 'bg-[var(--bg-secondary)] flex items-center justify-center')}>
        <ImageIcon className="h-4 w-4 text-[var(--text-tertiary)]" />
      </div>
    );
  }
  return <div className={cn(baseClass, 'glass-card')} />;
}

export function StylePicker({ value, color, onChange, photos }: StylePickerProps) {
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
    } else if (variant === 'gradient') {
      onChange(serializeCardStyle({ variant: 'gradient', colorEnd: parsed?.colorEnd ?? '' }));
    } else if (variant === 'photo') {
      if (!hasPhotos) return;
      onChange(serializeCardStyle({ variant: 'photo', coverPhotoId: parsed?.coverPhotoId ?? photos![0].id }));
    } else if (variant === 'border') {
      onChange(serializeCardStyle({ variant: 'border', borderColor: parsed?.borderColor, borderWidth: parsed?.borderWidth, borderStyle: parsed?.borderStyle }));
    } else if (variant === 'stripe') {
      onChange(serializeCardStyle({ variant: 'stripe', stripePosition: parsed?.stripePosition, stripeColor: parsed?.stripeColor, stripeWidth: parsed?.stripeWidth }));
    } else {
      onChange(serializeCardStyle({ variant }));
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border-subtle)]"
      >
        <div className="w-4 h-4 shrink-0">
          <VariantPreview variant={currentVariant} color={color} />
        </div>
        <span className="flex-1 text-left">{displayLabel}</span>
        {open ? <ChevronUp className="h-4 w-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />}
      </button>
      {open && (
        <div className="space-y-3 p-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          {/* Variant buttons */}
          <div className="grid grid-cols-5 gap-1.5">
            {VARIANTS.map((v) => {
              const isSelected = currentVariant === v.key;
              const disabled = v.key === 'photo' && !hasPhotos;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => !disabled && selectVariant(v.key)}
                  disabled={disabled}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-[var(--radius-sm)] transition-colors text-[11px]',
                    isSelected
                      ? 'bg-[var(--accent)] text-white'
                      : disabled
                        ? 'text-[var(--text-tertiary)] opacity-40 cursor-not-allowed'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  )}
                  title={disabled ? 'Add photos first' : v.label}
                >
                  <div className="w-full">
                    <VariantPreview variant={v.key} color={color} />
                  </div>
                  {v.label}
                </button>
              );
            })}
          </div>

          {/* Outline non-color controls */}
          {currentVariant === 'border' && (
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--text-tertiary)]">Thickness</p>
                <OptionGroup
                  options={BORDER_WIDTHS.map((w) => ({ key: w, label: `${w}px` }))}
                  value={(parsed?.borderWidth ?? '2') as BorderWidth}
                  onChange={(borderWidth) => updateStyle({ borderWidth })}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--text-tertiary)]">Border style</p>
                <OptionGroup
                  options={BORDER_STYLES}
                  value={(parsed?.borderStyle ?? 'solid') as BorderStyle}
                  onChange={(borderStyle) => updateStyle({ borderStyle })}
                />
              </div>
            </div>
          )}

          {/* Stripe non-color controls */}
          {currentVariant === 'stripe' && (
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--text-tertiary)]">Position</p>
                <OptionGroup
                  options={STRIPE_POSITIONS}
                  value={(parsed?.stripePosition ?? 'left') as StripePosition}
                  onChange={(stripePosition) => updateStyle({ stripePosition })}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--text-tertiary)]">Thickness</p>
                <OptionGroup
                  options={STRIPE_WIDTHS.map((w) => ({ key: w, label: w }))}
                  value={(parsed?.stripeWidth ?? '4') as StripeWidth}
                  onChange={(stripeWidth) => updateStyle({ stripeWidth: stripeWidth === '4' ? undefined : stripeWidth })}
                  gap="gap-1"
                />
              </div>
            </div>
          )}

          {/* Photo selector */}
          {currentVariant === 'photo' && hasPhotos && (
            <div className="space-y-1.5">
              <p className="text-[12px] text-[var(--text-tertiary)]">Cover photo</p>
              <div className="grid grid-cols-4 gap-1.5">
                {photos.map((photo) => {
                  const isSelected = parsed?.coverPhotoId === photo.id;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => updateStyle({ variant: 'photo', coverPhotoId: photo.id })}
                      className={cn(
                        'relative aspect-square rounded-[var(--radius-sm)] overflow-hidden transition-all',
                        isSelected
                          ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-elevated)]'
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
  );
}
