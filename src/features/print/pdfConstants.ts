/**
 * Shared layout constants used by both the HTML preview (LabelCell)
 * and PDF renderer (generateLabelPDF). Keeping a single source of
 * truth prevents visual drift between the two outputs.
 */

/** Monospace code width: 6 chars x 0.6em + 5 gaps x 0.2em */
export const MONO_CODE_WIDTH_EMS = 6 * 0.6 + 5 * 0.2;
