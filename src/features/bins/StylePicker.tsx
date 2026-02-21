import { useState } from 'react';
import { ChevronDown, ChevronUp, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ColorPicker } from './ColorPicker';
import { getPhotoThumbUrl } from '@/features/photos/usePhotos';
import type { CardStyleVariant } from '@/lib/cardStyle';
import { parseCardStyle, serializeCardStyle } from '@/lib/cardStyle';
import type { Photo } from '@/types';

interface StylePickerProps {
  value: string; // raw card_style JSON string
  color: string;
  onChange: (cardStyle: string) => void;
  onColorEndChange?: (colorEnd: string) => void;
  /** Available photos for the photo variant (only when editing existing bin) */
  photos?: Photo[];
}

const VARIANTS: { key: CardStyleVariant; label: string }[] = [
  { key: 'glass', label: 'Glass' },
  { key: 'outline', label: 'Outline' },
  { key: 'gradient', label: 'Gradient' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'photo', label: 'Photo' },
];

const STRIPE_POSITIONS: { key: string; label: string }[] = [
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
  { key: 'top', label: 'Top' },
  { key: 'bottom', label: 'Bottom' },
];

const STRIPE_TYPES: { key: string; label: string }[] = [
  { key: 'rounded', label: 'Rounded' },
  { key: 'straight', label: 'Straight' },
];

const STRIPE_WIDTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const BORDER_WIDTHS = ['1', '2', '3', '4'];
const BORDER_STYLES: { key: string; label: string }[] = [
  { key: 'solid', label: 'Solid' },
  { key: 'dashed', label: 'Dashed' },
  { key: 'dotted', label: 'Dotted' },
  { key: 'double', label: 'Double' },
];

function VariantPreview({ variant, color }: { variant: CardStyleVariant; color: string }) {
  const baseClass = 'aspect-square w-full rounded-[4px] transition-all';

  if (variant === 'glass') {
    return <div className={cn(baseClass, 'glass-card')} />;
  }
  if (variant === 'outline') {
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

  function selectVariant(variant: CardStyleVariant) {
    if (variant === 'glass') {
      onChange('');
    } else if (variant === 'gradient') {
      onChange(serializeCardStyle({ variant: 'gradient', colorEnd: parsed?.colorEnd ?? '' }));
    } else if (variant === 'photo') {
      if (!hasPhotos) return;
      onChange(serializeCardStyle({ variant: 'photo', coverPhotoId: parsed?.coverPhotoId ?? photos![0].id }));
    } else if (variant === 'outline') {
      onChange(serializeCardStyle({ variant: 'outline', borderColor: parsed?.borderColor, borderWidth: parsed?.borderWidth, borderStyle: parsed?.borderStyle }));
    } else if (variant === 'stripe') {
      onChange(serializeCardStyle({ variant: 'stripe', stripePosition: parsed?.stripePosition, stripeColor: parsed?.stripeColor, stripeType: parsed?.stripeType, stripeWidth: parsed?.stripeWidth }));
    } else {
      onChange(serializeCardStyle({ variant }));
    }
  }

  function selectCoverPhoto(photoId: string) {
    onChange(serializeCardStyle({ variant: 'photo', coverPhotoId: photoId }));
  }

  function setGradientEnd(colorEnd: string) {
    onChange(serializeCardStyle({ variant: 'gradient', colorEnd }));
  }

  function setStripePosition(stripePosition: string) {
    onChange(serializeCardStyle({ variant: 'stripe', stripePosition, stripeColor: parsed?.stripeColor, stripeType: parsed?.stripeType, stripeWidth: parsed?.stripeWidth }));
  }

  function setStripeColor(stripeColor: string) {
    onChange(serializeCardStyle({ variant: 'stripe', stripePosition: parsed?.stripePosition, stripeColor, stripeType: parsed?.stripeType, stripeWidth: parsed?.stripeWidth }));
  }

  function setStripeType(stripeType: string) {
    onChange(serializeCardStyle({ variant: 'stripe', stripePosition: parsed?.stripePosition, stripeColor: parsed?.stripeColor, stripeType: stripeType === 'rounded' ? undefined : stripeType, stripeWidth: parsed?.stripeWidth }));
  }

  function setStripeWidth(stripeWidth: string) {
    onChange(serializeCardStyle({ variant: 'stripe', stripePosition: parsed?.stripePosition, stripeColor: parsed?.stripeColor, stripeType: parsed?.stripeType, stripeWidth: stripeWidth === '4' ? undefined : stripeWidth }));
  }

  function setOutlineBorderColor(borderColor: string) {
    onChange(serializeCardStyle({ variant: 'outline', borderColor, borderWidth: parsed?.borderWidth, borderStyle: parsed?.borderStyle }));
  }

  function setOutlineBorderWidth(borderWidth: string) {
    onChange(serializeCardStyle({ variant: 'outline', borderColor: parsed?.borderColor, borderWidth, borderStyle: parsed?.borderStyle }));
  }

  function setOutlineBorderStyle(borderStyle: string) {
    onChange(serializeCardStyle({ variant: 'outline', borderColor: parsed?.borderColor, borderWidth: parsed?.borderWidth, borderStyle }));
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

          {/* Outline border + fill pickers */}
          {currentVariant === 'outline' && (
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--text-tertiary)]">Border color</p>
                <ColorPicker value={parsed?.borderColor ?? ''} onChange={setOutlineBorderColor} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--text-tertiary)]">Thickness</p>
                <div className="flex gap-1.5">
                  {BORDER_WIDTHS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setOutlineBorderWidth(w)}
                      className={cn(
                        'flex-1 py-1 rounded-full text-[12px] font-medium transition-colors',
                        (parsed?.borderWidth ?? '2') === w
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      )}
                    >
                      {w}px
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--text-tertiary)]">Border style</p>
                <div className="flex gap-1.5">
                  {BORDER_STYLES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setOutlineBorderStyle(s.key)}
                      className={cn(
                        'flex-1 py-1 rounded-full text-[12px] font-medium transition-colors',
                        (parsed?.borderStyle ?? 'solid') === s.key
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stripe type + position + color */}
          {currentVariant === 'stripe' && (
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--text-tertiary)]">Type</p>
                <div className="flex gap-1.5">
                  {STRIPE_TYPES.map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setStripeType(st.key)}
                      className={cn(
                        'flex-1 py-1 rounded-full text-[12px] font-medium transition-colors',
                        (parsed?.stripeType ?? 'rounded') === st.key
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      )}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--text-tertiary)]">Position</p>
                <div className="flex gap-1.5">
                  {STRIPE_POSITIONS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setStripePosition(p.key)}
                      className={cn(
                        'flex-1 py-1 rounded-full text-[12px] font-medium transition-colors',
                        (parsed?.stripePosition ?? 'left') === p.key
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--text-tertiary)]">Thickness</p>
                <div className="flex gap-1">
                  {STRIPE_WIDTHS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setStripeWidth(w)}
                      className={cn(
                        'flex-1 py-1 rounded-full text-[12px] font-medium transition-colors',
                        (parsed?.stripeWidth ?? '4') === w
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      )}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] text-[var(--text-tertiary)]">Stripe color</p>
                <ColorPicker value={parsed?.stripeColor ?? ''} onChange={setStripeColor} />
              </div>
            </div>
          )}

          {/* Gradient end-color picker */}
          {currentVariant === 'gradient' && (
            <div className="space-y-1.5">
              <p className="text-[12px] text-[var(--text-tertiary)]">End color</p>
              <ColorPicker value={parsed?.colorEnd ?? ''} onChange={setGradientEnd} />
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
                      onClick={() => selectCoverPhoto(photo.id)}
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
