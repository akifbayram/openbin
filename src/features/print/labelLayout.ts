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
import { parsePaddingPt } from './pdfUnits';
import type { LabelDirection } from './usePrintSettings';

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
  const { showQrCode, showBinCode, showColorSwatch, showIcon } = input;

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

  // QR and font metrics
  const qrSizePt = parseFloat(format.qrSize) * 72;
  const nameFontSizePt = parseFloat(format.nameFontSize);
  const codeFontSizePt = computeCodeFontSize(format, labelDirection);

  // QR code font size (for code rendered inside/under card)
  const qrCodeFontSizePt = qrSizePt / MONO_CODE_WIDTH_EMS;

  // Swatch bar height
  const swatchBarHeightPt = Math.max(SWATCH_BAR_MIN_PT, nameFontSizePt * SWATCH_BAR_HEIGHT_RATIO);

  // Card padding — clamped to fit within the content area
  const contentPadPt = parsePaddingPt(format.padding);
  const cellHPt = parseFloat(format.cellHeight) * 72;
  const cellWPt = parseFloat(format.cellWidth) * 72;
  const contentHeightPt = cellHPt - contentPadPt.top - contentPadPt.bottom;
  const codeHeightPt = codeUnderQr ? qrCodeFontSizePt : 0;
  const idealPadPt = Math.max(CARD_PAD_MIN_PT, qrSizePt * CARD_PAD_RATIO);
  const maxCardPadPt = Math.max(0, (contentHeightPt - qrSizePt - codeHeightPt) / 2);
  const cardPaddingPt = Math.min(idealPadPt, maxCardPadPt);

  // Card border radius
  const cardRadiusPt = Math.min(cellWPt, cellHPt) * CARD_RADIUS_RATIO;

  // Swatch bar only visible in non-colored-card mode when bin has a color
  const showSwatchBar = hasColor && showColorSwatch && !useColoredCard;

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
