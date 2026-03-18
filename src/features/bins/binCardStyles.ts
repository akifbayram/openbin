import type React from 'react';
import { getPhotoThumbUrl } from '@/features/photos/usePhotos';
import { getCardRenderProps, parseCardStyle } from '@/lib/cardStyle';
import { getPremadeUrl } from '@/lib/premadeBackgrounds';

/** Style constants for content overlaid on photo card backgrounds. */
const PHOTO_TEXT = 'rgba(255,255,255,0.8)';
const PHOTO_TEXT_STRONG = 'rgba(255,255,255,0.9)';
const PHOTO_SHADOW = '0 1px 3px rgba(0,0,0,0.5)';
const PHOTO_BORDER = 'rgba(255,255,255,0.7)';

/** Style for tag badges displayed over a photo card background. */
export const TAG_PHOTO_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(0,0,0,0.4)',
  color: '#fff',
  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
};

export interface BinCardComputedStyles {
  renderProps: ReturnType<typeof getCardRenderProps>;
  isPhoto: boolean;
  coverPhotoId: string | undefined;
  coverAssetId: string | undefined;
  /** Resolved cover image URL from either premade asset or uploaded photo. */
  coverImageSrc: string | undefined;
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
  const coverAssetId = cardStyle?.coverAssetId;
  const coverImageSrc = coverAssetId
    ? getPremadeUrl(coverAssetId)
    : coverPhotoId
      ? getPhotoThumbUrl(coverPhotoId)
      : undefined;
  const { mutedColor, primaryColor } = renderProps;

  const secondaryStyle: React.CSSProperties | undefined = isPhoto
    ? { color: PHOTO_TEXT, textShadow: PHOTO_SHADOW }
    : mutedColor ? { color: mutedColor } : undefined;

  const secondaryBorderStyle: React.CSSProperties | undefined = isPhoto
    ? { borderColor: PHOTO_BORDER }
    : mutedColor ? { borderColor: mutedColor } : undefined;

  const iconStyle: React.CSSProperties | undefined = isPhoto
    ? { color: PHOTO_TEXT }
    : mutedColor ? { color: mutedColor } : undefined;

  const nameStyle: React.CSSProperties | undefined = isPhoto && coverImageSrc
    ? { color: '#fff', textShadow: PHOTO_SHADOW }
    : primaryColor ? { color: primaryColor } : undefined;

  // Tags on dark-bg cards need a light treatment when no custom tag color is set
  const tagDefaultStyle: React.CSSProperties | undefined = primaryColor && !isPhoto
    ? { backgroundColor: 'rgba(255,255,255,0.15)', color: PHOTO_TEXT_STRONG }
    : undefined;

  return { renderProps, isPhoto, coverPhotoId, coverAssetId, coverImageSrc, mutedColor, secondaryStyle, secondaryBorderStyle, iconStyle, nameStyle, tagDefaultStyle };
}
