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
  photoTextStyle: React.CSSProperties | undefined;
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
  const { mutedColor } = renderProps;

  const secondaryStyle: React.CSSProperties | undefined = isPhoto
    ? { color: 'rgba(255,255,255,0.8)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }
    : mutedColor ? { color: mutedColor } : undefined;

  const secondaryBorderStyle: React.CSSProperties | undefined = isPhoto
    ? { borderColor: 'rgba(255,255,255,0.7)' }
    : mutedColor ? { borderColor: mutedColor } : undefined;

  const iconStyle: React.CSSProperties | undefined = isPhoto
    ? { color: 'rgba(255,255,255,0.8)' }
    : mutedColor ? { color: mutedColor } : undefined;

  const photoTextStyle: React.CSSProperties | undefined = isPhoto && coverPhotoId
    ? { color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }
    : undefined;

  return { renderProps, isPhoto, coverPhotoId, mutedColor, secondaryStyle, secondaryBorderStyle, iconStyle, photoTextStyle };
}
