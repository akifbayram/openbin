import type { LabelFormat } from './labelFormats';
import { computeCodeFontSize, isVerticalLayout } from './labelFormats';
import {
  CARD_PAD_MIN_PT,
  CARD_PAD_RATIO,
  CARD_RADIUS_RATIO,
  MONO_CODE_WIDTH_EMS,
  SWATCH_BAR_HEIGHT_RATIO,
  SWATCH_BAR_MIN_PT,
} from './pdfConstants';
import { parsePaddingPt, toPoints } from './pdfUnits';
import type { LabelDirection } from './usePrintSettings';

/** Max scale factor for name font relative to its static size */
const MAX_NAME_SCALE = 2.5;

/**
 * Rendering mode determined by label options and bin state.
 * - colored-card: QR wrapped in a rounded-rect card (color swatch + QR enabled)
 * - plain-qr: QR code without card wrapping
 * - icon-only: No QR, standalone icon displayed
 * - text-only: No QR or icon, only text elements
 */
export type LabelMode = 'colored-card' | 'plain-qr' | 'icon-only' | 'text-only';

export interface LabelLayoutInput {
  /** Cell dimensions from the label format */
  format: LabelFormat;
  /** Whether the bin has a QR data URL available */
  hasQrData: boolean;
  /** Whether the bin has a color set */
  hasColor: boolean;
  /** Whether the bin has a short code (bin ID) */
  hasCode: boolean;
  /** Whether the bin has an icon */
  hasIcon: boolean;
  /** Label direction override */
  labelDirection?: LabelDirection;
  /** Label visibility options */
  showQrCode: boolean;
  showBinName: boolean;
  showIcon: boolean;
  showBinCode: boolean;
  showColorSwatch: boolean;
}

/**
 * Shared derived layout values consumed by both the HTML preview (LabelCell)
 * and the PDF renderer (generateLabelPDF). Single source of truth for:
 * - Rendering mode selection
 * - Card padding and border radius
 * - Code font sizing
 * - Element visibility flags
 */
export interface LabelLayoutResult {
  /** Which rendering mode to use */
  mode: LabelMode;
  /** Whether the layout is portrait (vertical stacking) */
  isPortrait: boolean;
  /** Whether the short code should appear under the QR image */
  codeUnderQr: boolean;
  /** Whether a colored card wrapper should render */
  useColoredCard: boolean;
  /** Whether the color swatch bar should show (only in plain mode) */
  showSwatchBar: boolean;
  /** Card padding in points, clamped to fit within content area */
  cardPaddingPt: number;
  /** Card border radius in points */
  cardRadiusPt: number;
  /** Font size for the code rendered under the QR, in points */
  qrCodeFontSizePt: number;
  /** Content area padding parsed from the format, in points */
  contentPadPt: { top: number; right: number; bottom: number; left: number };
  /** QR size in points */
  qrSizePt: number;
  /** Swatch bar height in points */
  swatchBarHeightPt: number;
  /** Code font size in points (for standalone code, not under-QR) */
  codeFontSizePt: number;
  /** Name font size in points */
  nameFontSizePt: number;
}

/**
 * Compute derived layout values shared between HTML and PDF renderers.
 * Both renderers call this to get consistent mode, sizing, and visibility.
 */
export function computeLabelLayout(input: LabelLayoutInput): LabelLayoutResult {
  const { format, hasQrData, hasColor, hasCode, hasIcon, labelDirection } = input;
  const { showQrCode, showBinName, showBinCode, showColorSwatch, showIcon } = input;

  const isPortrait = isVerticalLayout(format, labelDirection);
  const qrAvailable = showQrCode && hasQrData;
  const useColoredCard = showColorSwatch && qrAvailable;
  const codeUnderQr = qrAvailable && showBinCode && hasCode;

  // Determine mode
  let mode: LabelMode;
  if (useColoredCard && qrAvailable) {
    mode = 'colored-card';
  } else if (qrAvailable) {
    mode = 'plain-qr';
  } else if (showIcon && hasIcon && !showQrCode) {
    mode = 'icon-only';
  } else {
    mode = 'text-only';
  }

  // Font metrics (base values from format)
  const baseNameFontPt = parseFloat(format.nameFontSize);
  const codeFontSizePt = computeCodeFontSize(format, labelDirection);
  const swatchBarHeightPt = Math.max(SWATCH_BAR_MIN_PT, baseNameFontPt * SWATCH_BAR_HEIGHT_RATIO);

  // Cell and content dimensions
  const contentPadPt = parsePaddingPt(format.padding);
  const cellHPt = toPoints(format.cellHeight);
  const cellWPt = toPoints(format.cellWidth);
  const contentHeightPt = cellHPt - contentPadPt.top - contentPadPt.bottom;
  const contentWidthPt = cellWPt - contentPadPt.left - contentPadPt.right;

  // Swatch bar only visible in non-colored-card mode when bin has a color
  const showSwatchBar = hasColor && showColorSwatch && !useColoredCard;

  // --- Dynamic QR sizing: grow QR to fill available space ---
  const staticQrSizePt = toPoints(format.qrSize);
  let qrSizePt = staticQrSizePt;

  if (mode === 'colored-card' || mode === 'plain-qr') {
    const codeRatio = codeUnderQr ? 1 / MONO_CODE_WIDTH_EMS : 0;
    let heightQr: number;
    let widthQr: number;

    if (isPortrait) {
      // Fixed text elements (don't scale with QR)
      let fixedTextPt = 0;
      let textCount = 0;
      if (showSwatchBar) { fixedTextPt += swatchBarHeightPt; textCount++; }
      if (!codeUnderQr && showBinCode && hasCode) { fixedTextPt += codeFontSizePt; textCount++; }
      if (showBinName) textCount++; // name height is variable (co-scales with QR)
      if (textCount > 1) fixedTextPt += textCount - 1; // 1pt inter-element gaps

      const gapPt = textCount > 0 ? 2 : 0;
      const avail = contentHeightPt - fixedTextPt - gapPt;

      // Name co-scales proportionally with QR: name = baseNameFont * (QR / staticQR)
      const nameRatio = showBinName && staticQrSizePt > 0 ? baseNameFontPt / staticQrSizePt : 0;
      const qrM = useColoredCard ? 1 + 2 * CARD_PAD_RATIO + codeRatio : 1 + codeRatio;
      heightQr = avail / (qrM + nameRatio);
      if (useColoredCard && heightQr * CARD_PAD_RATIO < CARD_PAD_MIN_PT) {
        heightQr = (avail - 2 * CARD_PAD_MIN_PT) / (1 + codeRatio + nameRatio);
      }

      // Cap name growth at MAX_NAME_SCALE, recompute QR with fixed name
      if (staticQrSizePt > 0 && heightQr / staticQrSizePt > MAX_NAME_SCALE) {
        const cappedNamePt = baseNameFontPt * MAX_NAME_SCALE;
        const availForQr = avail - (showBinName ? cappedNamePt : 0);
        heightQr = availForQr / qrM;
        if (useColoredCard && heightQr * CARD_PAD_RATIO < CARD_PAD_MIN_PT) {
          heightQr = (availForQr - 2 * CARD_PAD_MIN_PT) / (1 + codeRatio);
        }
      }

      widthQr = useColoredCard
        ? Math.min(contentWidthPt / (1 + 2 * CARD_PAD_RATIO), contentWidthPt - 2 * CARD_PAD_MIN_PT)
        : contentWidthPt;
    } else {
      // Landscape: QR constrained by content height
      if (useColoredCard) {
        const m = 1 + 2 * CARD_PAD_RATIO + codeRatio;
        heightQr = contentHeightPt / m;
        if (heightQr * CARD_PAD_RATIO < CARD_PAD_MIN_PT) {
          heightQr = (contentHeightPt - 2 * CARD_PAD_MIN_PT) / (1 + codeRatio);
        }
      } else {
        heightQr = contentHeightPt / (1 + codeRatio);
      }

      // Width: leave room for text column beside QR
      const hasText = showSwatchBar || (!codeUnderQr && showBinCode && hasCode) || showBinName;
      const minTextWidthPt = hasText ? baseNameFontPt * 3 : 0;
      const gapWidthPt = hasText ? 4 : 0;
      widthQr = useColoredCard
        ? Math.min(
            (contentWidthPt - gapWidthPt - minTextWidthPt) / (1 + 2 * CARD_PAD_RATIO),
            contentWidthPt - gapWidthPt - minTextWidthPt - 2 * CARD_PAD_MIN_PT,
          )
        : contentWidthPt - gapWidthPt - minTextWidthPt;
    }

    const optimalQrSizePt = Math.max(0, Math.min(heightQr, widthQr));
    qrSizePt = Math.max(staticQrSizePt, optimalQrSizePt);
  }

  // Scale name font proportionally to QR growth, capped at MAX_NAME_SCALE
  const nameScale = staticQrSizePt > 0
    ? Math.min(qrSizePt / staticQrSizePt, MAX_NAME_SCALE)
    : 1;
  const nameFontSizePt = baseNameFontPt * Math.max(1, nameScale);

  // Derived values from (potentially enlarged) QR size
  const qrCodeFontSizePt = qrSizePt / MONO_CODE_WIDTH_EMS;
  const codeHeightPt = codeUnderQr ? qrCodeFontSizePt : 0;
  const idealPadPt = Math.max(CARD_PAD_MIN_PT, qrSizePt * CARD_PAD_RATIO);
  const maxCardPadPt = Math.max(0, (contentHeightPt - qrSizePt - codeHeightPt) / 2);
  const cardPaddingPt = Math.min(idealPadPt, maxCardPadPt);
  const cardRadiusPt = Math.min(cellWPt, cellHPt) * CARD_RADIUS_RATIO;

  return {
    mode,
    isPortrait,
    codeUnderQr,
    useColoredCard,
    showSwatchBar,
    cardPaddingPt,
    cardRadiusPt,
    qrCodeFontSizePt,
    contentPadPt,
    qrSizePt,
    swatchBarHeightPt,
    codeFontSizePt,
    nameFontSizePt,
  };
}
