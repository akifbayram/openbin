import { relativeLuminance } from '@/lib/colorPalette';

/** Average character width ratio for bold sans-serif (approximate). */
const AVG_CHAR_WIDTH_RATIO = 0.6;
const MIN_FONT_PT = 8;
const MAX_FONT_PT = 200;
export const ICON_SCALE = 0.9;
/** Gap between icon and text, as a ratio of font size. */
export const ICON_GAP_RATIO = 0.3;
/** Fallback character count for empty names (bin short code length). */
const EMPTY_NAME_LENGTH = 6;

export interface NameFontSizeInput {
  cellWidthPt: number;
  cellHeightPt: number;
  paddingPt: number;
  name: string;
  hasIcon: boolean;
}

export interface NameFontSizeResult {
  fontSizePt: number;
  iconSizePt: number;
}

/**
 * Compute the largest single-line font size that fits within a name card cell.
 * Uses character-count heuristic (no DOM measurement).
 */
export function computeNameFontSize(input: NameFontSizeInput): NameFontSizeResult {
  const { cellWidthPt, cellHeightPt, paddingPt, name, hasIcon } = input;
  const nameLen = name.length || EMPTY_NAME_LENGTH;

  const maxByHeight = (cellHeightPt - 2 * paddingPt) * 0.7;

  const totalPad = 2 * paddingPt;
  let maxByWidth: number;

  if (hasIcon) {
    const charUnits = nameLen * AVG_CHAR_WIDTH_RATIO + ICON_SCALE + ICON_GAP_RATIO;
    maxByWidth = (cellWidthPt - totalPad) / charUnits;
  } else {
    maxByWidth = (cellWidthPt - totalPad) / (nameLen * AVG_CHAR_WIDTH_RATIO);
  }

  const raw = Math.min(maxByHeight, maxByWidth);
  const fontSizePt = Math.max(MIN_FONT_PT, Math.min(MAX_FONT_PT, raw));
  const iconSizePt = fontSizePt * ICON_SCALE;

  return { fontSizePt, iconSizePt };
}

/**
 * Return black or white text color for readable contrast on the given background.
 * Uses W3C relative luminance with a threshold tuned for print readability.
 */
export function computeContrastFg(bgHex: string): '#FFFFFF' | '#000000' {
  return relativeLuminance(bgHex) > 0.179 ? '#000000' : '#FFFFFF';
}
