import { getColorPreset } from './colorPalette';

export type CardStyleVariant = 'glass' | 'outline' | 'gradient' | 'stripe' | 'photo';

export interface CardStyle {
  variant: CardStyleVariant;
  colorEnd?: string;
  coverPhotoId?: string;
  borderColor?: string;
  fillColor?: string;
  borderWidth?: string;
  borderStyle?: string;
  stripePosition?: string;
  stripeColor?: string;
  stripeType?: string; // 'straight' | undefined (undefined = rounded, for backward compat)
  stripeWidth?: string; // '1'..'10', default '4'
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
  stripeBar?: { color: string; position: 'left' | 'right' | 'top' | 'bottom'; width: number };
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
    const colorBg = colorPreset ? (theme === 'dark' ? colorPreset.bgDark : colorPreset.bg) : undefined;
    const mutedColor = colorPreset
      ? (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)')
      : undefined;
    return {
      className: 'glass-card',
      style: colorBg ? { backgroundColor: colorBg } : {},
      mutedColor,
      isPhotoVariant: false,
    };
  }

  if (variant === 'outline') {
    const borderPreset = getColorPreset(cardStyle.borderColor ?? '');
    const borderResolved = borderPreset?.dot ?? colorPreset?.dot ?? 'var(--border)';

    const colorBg = colorPreset ? (theme === 'dark' ? colorPreset.bgDark : colorPreset.bg) : undefined;

    const width = cardStyle.borderWidth ?? '2';
    const bStyle = cardStyle.borderStyle ?? 'solid';

    return {
      className: 'glass-card',
      style: {
        border: `${width}px ${bStyle} ${borderResolved}`,
        ...(colorBg ? { backgroundColor: colorBg } : {}),
      },
      mutedColor: colorPreset
        ? (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)')
        : undefined,
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
    const colorBg = colorPreset ? (theme === 'dark' ? colorPreset.bgDark : colorPreset.bg) : undefined;

    const stripePreset = getColorPreset(cardStyle.stripeColor ?? '');
    const stripeResolved = stripePreset?.dot ?? colorPreset?.dot ?? 'var(--accent)';

    const pos = (cardStyle.stripePosition ?? 'left') as 'left' | 'right' | 'top' | 'bottom';
    const sw = Number(cardStyle.stripeWidth) || 4;

    if (cardStyle.stripeType === 'straight') {
      return {
        className: 'glass-card',
        style: {
          position: 'relative',
          overflow: 'hidden',
          ...(colorBg ? { backgroundColor: colorBg } : {}),
        },
        mutedColor: colorPreset
          ? (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)')
          : undefined,
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
      mutedColor: colorPreset
        ? (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)')
        : undefined,
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
