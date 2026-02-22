import type { ColorPreset } from './colorPalette';
import { resolveColor } from './colorPalette';

export type CardStyleVariant = 'glass' | 'border' | 'gradient' | 'stripe' | 'photo';
export type StripePosition = 'left' | 'right' | 'top' | 'bottom';
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double';
export type BorderWidth = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' ;
export type StripeWidth = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';

export interface CardStyle {
  variant: CardStyleVariant;
  colorEnd?: string;
  coverPhotoId?: string;
  borderColor?: string;
  fillColor?: string;
  borderWidth?: BorderWidth;
  borderStyle?: BorderStyle;
  stripePosition?: StripePosition;
  stripeColor?: string;
  stripeWidth?: StripeWidth;
}

/** Parse the card_style JSON string from the DB. Returns null for default glass. */
export function parseCardStyle(raw: string): CardStyle | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.variant) {
      // Migrate legacy "outline" → "border"
      if (parsed.variant === 'outline') parsed.variant = 'border';
      return parsed as CardStyle;
    }
  } catch {
    // Ignore malformed JSON
  }
  return null;
}

/** Serialize a CardStyle to JSON string for the DB. Returns '' for default glass. */
export function serializeCardStyle(style: CardStyle | null): string {
  if (!style || style.variant === 'glass') return '';
  return JSON.stringify(style);
}

export interface CardRenderProps {
  className: string;
  style: React.CSSProperties;
  mutedColor: string | undefined;
  isPhotoVariant: boolean;
  stripeBar?: { color: string; position: StripePosition; width: number };
}

/** Return muted text color when a color preset is active, undefined otherwise. */
function getMutedColor(colorPreset: ColorPreset | undefined, theme: 'light' | 'dark'): string | undefined {
  return colorPreset
    ? (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)')
    : undefined;
}

/** Return the preset background CSS value, undefined if no preset. */
function getColorBg(colorPreset: ColorPreset | undefined): string | undefined {
  return colorPreset?.bgCss;
}

type SecondaryColorField = 'borderColor' | 'colorEnd' | 'stripeColor';

const SECONDARY_COLOR_MAP: Partial<Record<CardStyleVariant, { field: SecondaryColorField; label: string }>> = {
  border: { field: 'borderColor', label: 'Border color' },
  gradient: { field: 'colorEnd', label: 'End color' },
  stripe: { field: 'stripeColor', label: 'Stripe color' },
};

/** Get the secondary color info for a card style, or null if the variant doesn't use one. */
export function getSecondaryColorInfo(cardStyleRaw: string): { label: string; value: string } | null {
  const parsed = parseCardStyle(cardStyleRaw);
  if (!parsed) return null;
  const mapping = SECONDARY_COLOR_MAP[parsed.variant];
  if (!mapping) return null;
  return { label: mapping.label, value: (parsed[mapping.field] as string) ?? '' };
}

/** Return a new card_style JSON string with the secondary color updated. */
export function setSecondaryColor(cardStyleRaw: string, color: string): string {
  const parsed = parseCardStyle(cardStyleRaw);
  if (!parsed) return cardStyleRaw;
  const mapping = SECONDARY_COLOR_MAP[parsed.variant];
  if (!mapping) return cardStyleRaw;
  return serializeCardStyle({ ...parsed, [mapping.field]: color });
}

/** Compute CSS class + inline style for a bin card based on its color + card_style. */
export function getCardRenderProps(
  colorKey: string,
  cardStyleRaw: string,
  theme: 'light' | 'dark',
): CardRenderProps {
  const cardStyle = parseCardStyle(cardStyleRaw);
  const variant = cardStyle?.variant ?? 'glass';
  const colorPreset = resolveColor(colorKey);

  // Default glass: existing behavior
  if (variant === 'glass' || !cardStyle) {
    const colorBg = getColorBg(colorPreset);
    return {
      className: 'glass-card',
      style: colorBg ? { backgroundColor: colorBg } : {},
      mutedColor: getMutedColor(colorPreset, theme),
      isPhotoVariant: false,
    };
  }

  if (variant === 'border') {
    const borderPreset = resolveColor(cardStyle.borderColor ?? '');
    const borderResolved = borderPreset?.bgCss ?? colorPreset?.bgCss ?? 'var(--border)';
    const colorBg = getColorBg(colorPreset);
    const width = cardStyle.borderWidth ?? '2';
    const bStyle = cardStyle.borderStyle ?? 'solid';

    return {
      className: 'glass-card',
      style: {
        outline: `${width}px ${bStyle} ${borderResolved}`,
        outlineOffset: `-${width}px`,
        borderColor: 'transparent',
        ...(colorBg ? { backgroundColor: colorBg } : {}),
      },
      mutedColor: getMutedColor(colorPreset, theme),
      isPhotoVariant: false,
    };
  }

  if (variant === 'gradient') {
    const startColor = colorPreset?.bgCss ?? (theme === 'dark' ? '#374151' : '#D1D5DB');
    const endPreset = resolveColor(cardStyle.colorEnd ?? '');
    const endColor = endPreset?.bgCss ?? (theme === 'dark' ? '#1f2937' : '#f3f4f6');
    return {
      className: '',
      style: {
        background: `linear-gradient(135deg, ${startColor}, ${endColor})`,
        borderRadius: 'var(--radius-lg)',
      },
      mutedColor: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)',
      isPhotoVariant: false,
    };
  }

  if (variant === 'stripe') {
    const colorBg = getColorBg(colorPreset);
    const stripePreset = resolveColor(cardStyle.stripeColor ?? '');
    const stripeResolved = stripePreset?.bgCss ?? colorPreset?.bgCss ?? 'var(--accent)';
    const pos = cardStyle.stripePosition ?? 'left';
    const sw = Number(cardStyle.stripeWidth) || 4;

    return {
      className: 'glass-card',
      style: {
        position: 'relative',
        overflow: 'hidden',
        ...(colorBg ? { backgroundColor: colorBg } : {}),
      },
      mutedColor: getMutedColor(colorPreset, theme),
      isPhotoVariant: false,
      stripeBar: { color: stripeResolved, position: pos, width: sw },
    };
  }

  if (variant === 'photo') {
    return {
      className: '',
      style: {
        borderRadius: 'var(--radius-lg)',
        position: 'relative',
        overflow: 'hidden',
      },
      mutedColor: 'rgba(255,255,255,0.7)',
      isPhotoVariant: true,
    };
  }

  // Fallback
  return {
    className: 'glass-card',
    style: {},
    mutedColor: undefined,
    isPhotoVariant: false,
  };
}
