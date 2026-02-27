import type React from 'react';
import { getCardRenderProps, parseCardStyle } from '@/lib/cardStyle';

export interface BinCardComputedStyles {
  renderProps: ReturnType<typeof getCardRenderProps>;
  isPhoto: boolean;
  coverPhotoId: string | undefined;
  mutedColor: string | undefined;
  secondaryStyle: React.CSSProperties | undefined;
  secondaryBorderStyle: React.CSSProperties | undefined;
  iconStyle: React.CSSProperties | undefined;
  nameStyle: React.CSSProperties | undefined;
  /** Fallback style for tags without a custom tag color on dark-bg cards. */
  tagDefaultStyle: React.CSSProperties | undefined;
}

/** Compute all derived style objects for BinCard / BinCompactCard. */
export function computeBinCardStyles(
  color: string,
  cardStyleRaw: string,
  theme: 'light' | 'dark',
): BinCardComputedStyles {
  const renderProps = getCardRenderProps(color, cardStyleRaw, theme);
  const cardStyle = parseCardStyle(cardStyleRaw);
  const isPhoto = renderProps.isPhotoVariant;
  const coverPhotoId = cardStyle?.coverPhotoId;
  const { mutedColor, primaryColor } = renderProps;

  const secondaryStyle: React.CSSProperties | undefined = isPhoto
    ? { color: 'rgba(255,255,255,0.8)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }
    : mutedColor ? { color: mutedColor } : undefined;

  const secondaryBorderStyle: React.CSSProperties | undefined = isPhoto
    ? { borderColor: 'rgba(255,255,255,0.7)' }
    : mutedColor ? { borderColor: mutedColor } : undefined;

  const iconStyle: React.CSSProperties | undefined = isPhoto
    ? { color: 'rgba(255,255,255,0.8)' }
    : mutedColor ? { color: mutedColor } : undefined;

  const nameStyle: React.CSSProperties | undefined = isPhoto && coverPhotoId
    ? { color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }
    : primaryColor ? { color: primaryColor } : undefined;

  // Tags on dark-bg cards need a light treatment when no custom tag color is set
  const tagDefaultStyle: React.CSSProperties | undefined = primaryColor && !isPhoto
    ? { backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }
    : undefined;

  return { renderProps, isPhoto, coverPhotoId, mutedColor, secondaryStyle, secondaryBorderStyle, iconStyle, nameStyle, tagDefaultStyle };
}
