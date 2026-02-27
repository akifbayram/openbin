import type { ColorPreset } from './colorPalette';
import { resolveColor, getApproxBgHex, needsLightText } from './colorPalette';

const MUTED_DARK = 'rgba(255,255,255,0.7)';
const MUTED_LIGHT = 'rgba(0,0,0,0.55)';
const TEXT_LIGHT = '#f5f5f7';
const TEXT_DARK = '#1c1c1e';

export type CardStyleVariant = 'glass' | 'border' | 'gradient' | 'stripe' | 'photo';
export type StripePosition = 'left' | 'right' | 'top' | 'bottom';
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double';
export type BorderWidth = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' ;
export type StripeWidth = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';

export interface CardStyle {
  variant: CardStyleVariant;
  secondaryColor?: string;
  coverPhotoId?: string;
  borderWidth?: BorderWidth;
  borderStyle?: BorderStyle;
  stripePosition?: StripePosition;
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
  primaryColor: string | undefined;
  isPhotoVariant: boolean;
  stripeBar?: { color: string; position: StripePosition; width: number };
}

/** Return primary + muted text colors based on background luminance, or undefined if no preset. */
function getTextColors(colorPreset: ColorPreset | undefined, theme: 'light' | 'dark'): { primary: string | undefined; muted: string | undefined } {
  if (!colorPreset) return { primary: undefined, muted: undefined };
  const approxBg = getApproxBgHex(colorPreset, theme);
  const light = needsLightText(approxBg);
  // Theme defaults: light theme → TEXT_DARK, dark theme → TEXT_LIGHT
  const themeDefault = theme === 'dark' ? 'light' : 'dark';
  const needed = light ? 'light' : 'dark';
  return {
    primary: needed !== themeDefault ? (light ? TEXT_LIGHT : TEXT_DARK) : undefined,
    muted: light ? MUTED_DARK : MUTED_LIGHT,
  };
}

/** Return the preset background CSS value, undefined if no preset. */
function getColorBg(colorPreset: ColorPreset | undefined): string | undefined {
  return colorPreset?.bgCss;
}

const SECONDARY_COLOR_LABEL: Partial<Record<CardStyleVariant, string>> = {
  border: 'Border Color',
  gradient: 'End Color',
  stripe: 'Stripe Color',
};

/** Get the secondary color info for a card style, or null if the variant doesn't use one. */
export function getSecondaryColorInfo(cardStyleRaw: string): { label: string; value: string } | null {
  const parsed = parseCardStyle(cardStyleRaw);
  if (!parsed) return null;
  const label = SECONDARY_COLOR_LABEL[parsed.variant];
  if (!label) return null;
  return { label, value: parsed.secondaryColor ?? '' };
}

/** Return a new card_style JSON string with the secondary color updated. */
export function setSecondaryColor(cardStyleRaw: string, color: string): string {
  const parsed = parseCardStyle(cardStyleRaw);
  if (!parsed) return cardStyleRaw;
  if (!SECONDARY_COLOR_LABEL[parsed.variant]) return cardStyleRaw;
  return serializeCardStyle({ ...parsed, secondaryColor: color });
}

function renderGlassProps(colorPreset: ColorPreset | undefined, theme: 'light' | 'dark'): CardRenderProps {
  const colorBg = getColorBg(colorPreset);
  const { primary, muted } = getTextColors(colorPreset, theme);
  return {
    className: 'glass-card',
    style: colorBg ? { backgroundColor: colorBg } : {},
    mutedColor: muted,
    primaryColor: primary,
    isPhotoVariant: false,
  };
}

function renderBorderProps(cardStyle: CardStyle, colorPreset: ColorPreset | undefined, theme: 'light' | 'dark'): CardRenderProps {
  const borderPreset = resolveColor(cardStyle.secondaryColor ?? '');
  const borderResolved = borderPreset?.bgCss ?? colorPreset?.bgCss ?? 'var(--border)';
  const colorBg = getColorBg(colorPreset);
  const width = cardStyle.borderWidth ?? '2';
  const bStyle = cardStyle.borderStyle ?? 'solid';
  const { primary, muted } = getTextColors(colorPreset, theme);

  return {
    className: 'glass-card',
    style: {
      outline: `${width}px ${bStyle} ${borderResolved}`,
      outlineOffset: `-${width}px`,
      borderColor: 'transparent',
      ...(colorBg ? { backgroundColor: colorBg } : {}),
    },
    mutedColor: muted,
    primaryColor: primary,
    isPhotoVariant: false,
  };
}

function renderGradientProps(cardStyle: CardStyle, colorPreset: ColorPreset | undefined, theme: 'light' | 'dark'): CardRenderProps {
  const startColor = colorPreset?.bgCss ?? (theme === 'dark' ? '#374151' : '#D1D5DB');
  const endPreset = resolveColor(cardStyle.secondaryColor ?? '');
  const endColor = endPreset?.bgCss ?? (theme === 'dark' ? '#1f2937' : '#f3f4f6');
  const { primary, muted } = getTextColors(colorPreset, theme);
  return {
    className: '',
    style: {
      background: `linear-gradient(135deg, ${startColor}, ${endColor})`
    },
    mutedColor: muted ?? (theme === 'dark' ? MUTED_DARK : MUTED_LIGHT),
    primaryColor: primary,
    isPhotoVariant: false,
  };
}

function renderStripeProps(cardStyle: CardStyle, colorPreset: ColorPreset | undefined, theme: 'light' | 'dark'): CardRenderProps {
  const colorBg = getColorBg(colorPreset);
  const stripePreset = resolveColor(cardStyle.secondaryColor ?? '');
  const stripeResolved = stripePreset?.bgCss ?? colorPreset?.bgCss ?? 'var(--accent)';
  const pos = cardStyle.stripePosition ?? 'left';
  const sw = Number(cardStyle.stripeWidth) || 4;
  const { primary, muted } = getTextColors(colorPreset, theme);

  return {
    className: 'glass-card',
    style: {
      position: 'relative',
      overflow: 'hidden',
      ...(colorBg ? { backgroundColor: colorBg } : {}),
    },
    mutedColor: muted,
    primaryColor: primary,
    isPhotoVariant: false,
    stripeBar: { color: stripeResolved, position: pos, width: sw },
  };
}

function renderPhotoProps(): CardRenderProps {
  return {
    className: '',
    style: {
      position: 'relative',
      overflow: 'hidden',
      border: '0.5px solid transparent',
    },
    mutedColor: MUTED_DARK,
    primaryColor: undefined,
    isPhotoVariant: true,
  };
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

  switch (variant) {
    case 'glass':
      return renderGlassProps(colorPreset, theme);
    case 'border':
      return renderBorderProps(cardStyle!, colorPreset, theme);
    case 'gradient':
      return renderGradientProps(cardStyle!, colorPreset, theme);
    case 'stripe':
      return renderStripeProps(cardStyle!, colorPreset, theme);
    case 'photo':
      return renderPhotoProps();
    default:
      return { className: 'glass-card', style: {}, mutedColor: undefined, primaryColor: undefined, isPhotoVariant: false };
  }
}
