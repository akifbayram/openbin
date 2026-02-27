/**
 * Shared layout constants used by both the HTML preview (LabelCell)
 * and PDF renderer (generateLabelPDF). Keeping a single source of
 * truth prevents visual drift between the two outputs.
 */

/** Monospace code width: 6 chars x 0.6em + 5 gaps x 0.2em */
export const MONO_CODE_WIDTH_EMS = 6 * 0.6 + 5 * 0.2;

/** Swatch bar height = max(SWATCH_BAR_MIN_PT, nameFontSizePt * SWATCH_BAR_HEIGHT_RATIO) */
export const SWATCH_BAR_HEIGHT_RATIO = 0.45;
export const SWATCH_BAR_MIN_PT = 2;

/** Card padding = max(CARD_PAD_MIN_PT, qrSizePt * CARD_PAD_RATIO) */
export const CARD_PAD_RATIO = 0.07;
export const CARD_PAD_MIN_PT = 3;

/** Card border radius = min(cellWPt, cellHPt) * CARD_RADIUS_RATIO */
export const CARD_RADIUS_RATIO = 0.08;
