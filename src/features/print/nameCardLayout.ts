import { relativeLuminance } from '@/lib/colorPalette';
import type { Bin } from '@/types';
import { parsePaddingPt } from './pdfUnits';

/** Neutral background for name cells when color is disabled. */
export const NAME_CARD_NEUTRAL_BG = '#ffffff';

/** Average character width ratio for bold sans-serif (approximate). */
const AVG_CHAR_WIDTH_RATIO = 0.6;
const MIN_FONT_PT = 8;
const MAX_FONT_PT = 200;
export const ICON_SCALE = 0.9;
/** Gap between icon and text, as a ratio of font size. */
export const ICON_GAP_RATIO = 0.3;
/** Fallback character count for empty names (bin short code length). */
const EMPTY_NAME_LENGTH = 6;
/** Max characters to fit on a single line before wrapping. */
const MAX_CHARS_PER_LINE = 20;

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
  const actualLen = name.length || EMPTY_NAME_LENGTH;
  const fitLen = Math.min(actualLen, MAX_CHARS_PER_LINE);
  const lineCount = Math.ceil(actualLen / MAX_CHARS_PER_LINE);
  const lineHeight = 1.15;

  const maxByHeight = (cellHeightPt - 2 * paddingPt) / (lineCount * lineHeight);

  const totalPad = 2 * paddingPt;
  let maxByWidth: number;

  if (hasIcon) {
    const charUnits = fitLen * AVG_CHAR_WIDTH_RATIO + ICON_SCALE + ICON_GAP_RATIO;
    maxByWidth = (cellWidthPt - totalPad) / charUnits;
  } else {
    maxByWidth = (cellWidthPt - totalPad) / (fitLen * AVG_CHAR_WIDTH_RATIO);
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

/** Collapse 4-sided CSS padding into a single max value in points. */
export function maxPaddingPt(padding: string): number {
  const pad = parsePaddingPt(padding);
  return Math.max(pad.top, pad.right, pad.bottom, pad.left);
}

/** Compute the minimum font size across all bins (for uniform sizing mode). */
export function computeUniformFontSize(
  bins: Bin[],
  cellWPt: number,
  cellHPt: number,
  paddingPt: number,
  showIcon: boolean,
): number {
  return Math.min(
    ...bins.map((bin) => {
      const displayName = bin.name || bin.short_code;
      const hasIcon = showIcon && !!bin.icon;
      return computeNameFontSize({ cellWidthPt: cellWPt, cellHeightPt: cellHPt, paddingPt, name: displayName, hasIcon }).fontSizePt;
    }),
  );
}
