import type { ColorPreset } from './colorPalette';
import { getColorPreset } from './colorPalette';

export type CardStyleVariant = 'glass' | 'outline' | 'gradient' | 'stripe' | 'photo';
export type StripePosition = 'left' | 'right' | 'top' | 'bottom';
export type StripeType = 'straight';  // undefined = rounded
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double';
export type BorderWidth = '1' | '2' | '3' | '4';
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
  stripeType?: StripeType;
  stripeWidth?: StripeWidth;
}

/** Parse the card_style JSON string from the DB. Returns null for default glass. */
export function parseCardStyle(raw: string): CardStyle | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.variant) {
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

/** Return the preset background for the given theme, undefined if no preset. */
function getColorBg(colorPreset: ColorPreset | undefined, theme: 'light' | 'dark'): string | undefined {
  return colorPreset ? (theme === 'dark' ? colorPreset.bgDark : colorPreset.bg) : undefined;
}

/** Compute CSS class + inline style for a bin card based on its color + card_style. */
export function getCardRenderProps(
  colorKey: string,
  cardStyleRaw: string,
  theme: 'light' | 'dark',
): CardRenderProps {
  const cardStyle = parseCardStyle(cardStyleRaw);
  const variant = cardStyle?.variant ?? 'glass';
  const colorPreset = getColorPreset(colorKey);

  // Default glass: existing behavior
  if (variant === 'glass' || !cardStyle) {
    const colorBg = getColorBg(colorPreset, theme);
    return {
      className: 'glass-card',
      style: colorBg ? { backgroundColor: colorBg } : {},
      mutedColor: getMutedColor(colorPreset, theme),
      isPhotoVariant: false,
    };
  }

  if (variant === 'outline') {
    const borderPreset = getColorPreset(cardStyle.borderColor ?? '');
    const borderResolved = borderPreset?.dot ?? colorPreset?.dot ?? 'var(--border)';
    const colorBg = getColorBg(colorPreset, theme);
    const width = cardStyle.borderWidth ?? '2';
    const bStyle = cardStyle.borderStyle ?? 'solid';

    return {
      className: 'glass-card',
      style: {
        border: `${width}px ${bStyle} ${borderResolved}`,
        ...(colorBg ? { backgroundColor: colorBg } : {}),
      },
      mutedColor: getMutedColor(colorPreset, theme),
      isPhotoVariant: false,
    };
  }

  if (variant === 'gradient') {
    const startColor = colorPreset ? (theme === 'dark' ? colorPreset.bgDark : colorPreset.bg) : (theme === 'dark' ? '#374151' : '#D1D5DB');
    const endPreset = getColorPreset(cardStyle.colorEnd ?? '');
    const endColor = endPreset ? (theme === 'dark' ? endPreset.bgDark : endPreset.bg) : (theme === 'dark' ? '#1f2937' : '#f3f4f6');
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
    const colorBg = getColorBg(colorPreset, theme);
    const stripePreset = getColorPreset(cardStyle.stripeColor ?? '');
    const stripeResolved = stripePreset?.dot ?? colorPreset?.dot ?? 'var(--accent)';
    const pos = cardStyle.stripePosition ?? 'left';
    const sw = Number(cardStyle.stripeWidth) || 4;

    if (cardStyle.stripeType === 'straight') {
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

    const borderProp =
      pos === 'right' ? 'borderRight'
      : pos === 'top' ? 'borderTop'
      : pos === 'bottom' ? 'borderBottom'
      : 'borderLeft';

    return {
      className: 'glass-card',
      style: {
        [borderProp]: `${sw}px solid ${stripeResolved}`,
        ...(colorBg ? { backgroundColor: colorBg } : {}),
      },
      mutedColor: getMutedColor(colorPreset, theme),
      isPhotoVariant: false,
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
