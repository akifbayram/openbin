import type { Bin } from '@/types';
import type { LabelFormat } from './labelFormats';
import { getOrientation, computeLabelsPerPage, computePageSize, computeCodeFontSize } from './labelFormats';
import { resolveColor } from '@/lib/colorPalette';
import { toInches, parsePaddingPt } from './pdfUnits';
import type { LabelOptions } from './usePrintSettings';

interface GenerateLabelPDFParams {
  bins: Bin[];
  format: LabelFormat;
  labelOptions: LabelOptions;
  qrMap: Map<string, string>;
  iconMap: Map<string, string>;
  iconSize: string;
}

/** Truncate text to fit within maxWidth, adding ellipsis if needed. */
function truncateToWidth(doc: import('jspdf').jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && doc.getTextWidth(`${truncated}\u2026`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}\u2026`;
}

/** Parse hex color string to RGB tuple. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export async function generateLabelPDF(params: GenerateLabelPDFParams): Promise<Blob> {
  const { bins, format, labelOptions, qrMap, iconMap, iconSize } = params;
  const { default: jsPDF } = await import('jspdf');

  const isPortrait = getOrientation(format) === 'portrait';
  const perPage = computeLabelsPerPage(format);
  const { width: pageWidth, height: pageHeight } = computePageSize(format);

  const doc = new jsPDF({
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
    unit: 'in',
    format: [pageWidth, pageHeight],
  });

  // Split bins into pages
  const pages: Bin[][] = [];
  for (let i = 0; i < bins.length; i += perPage) {
    pages.push(bins.slice(i, i + perPage));
  }

  const marginTop = parseFloat(format.pageMarginTop);
  const marginLeft = parseFloat(format.pageMarginLeft);
  const cellW = parseFloat(format.cellWidth);
  const cellH = parseFloat(format.cellHeight);
  const qrSize = parseFloat(format.qrSize);
  const pad = parsePaddingPt(format.padding);
  // Convert pad from pt to inches
  const padIn = { top: pad.top / 72, right: pad.right / 72, bottom: pad.bottom / 72, left: pad.left / 72 };
  const gapIn = 4 / 72; // 4pt gap in inches
  const codeFontSizePt = computeCodeFontSize(format);
  const nameFontSizePt = parseFloat(format.nameFontSize);
  const contentFontSizePt = parseFloat(format.contentFontSize);
  const iconSizeIn = toInches(iconSize);
  const barHeightIn = Math.max(2, nameFontSizePt * 0.45) / 72;
  const qrSizePt = qrSize * 72;
  const cardPadIn = Math.max(3, qrSizePt * 0.07) / 72; // 7% of QR size, min 3pt
  const cellWPt = cellW * 72;
  const cellHPt = cellH * 72;
  const cardRadiusIn = (Math.min(cellWPt, cellHPt) * 0.08) / 72;

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    if (pageIdx > 0) doc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'landscape' : 'portrait');

    const pageBins = pages[pageIdx];
    for (let binIdx = 0; binIdx < pageBins.length; binIdx++) {
      const bin = pageBins[binIdx];
      const col = binIdx % format.columns;
      const row = Math.floor(binIdx / format.columns);

      const cellX = marginLeft + col * cellW;
      const cellY = marginTop + row * cellH;

      // Content box
      const contentX = cellX + padIn.left;
      const contentY = cellY + padIn.top;
      const contentW = cellW - padIn.left - padIn.right;
      const contentH = cellH - padIn.top - padIn.bottom;

      const qrDataUrl = qrMap.get(bin.id);
      const hasQr = labelOptions.showQrCode && !!qrDataUrl;
      const hasIcon = labelOptions.showIcon;
      const colorPreset = labelOptions.showColorSwatch && bin.color ? resolveColor(bin.color) : undefined;
      const useColoredCard = labelOptions.showColorSwatch && hasQr;

      if (isPortrait) {
        drawPortraitLabel(doc, {
          bin, contentX, contentY, contentW, contentH,
          qrSize, qrDataUrl: hasQr ? qrDataUrl! : null,
          hasIcon, iconMap, iconSizeIn,
          colorPreset, barHeightIn,
          codeFontSizePt, nameFontSizePt, contentFontSizePt,
          labelOptions, gapIn, useColoredCard, cardPadIn, cardRadiusIn,
        });
      } else {
        drawLandscapeLabel(doc, {
          bin, contentX, contentY, contentW, contentH,
          qrSize, qrDataUrl: hasQr ? qrDataUrl! : null,
          hasIcon, iconMap, iconSizeIn,
          colorPreset, barHeightIn,
          codeFontSizePt, nameFontSizePt, contentFontSizePt,
          labelOptions, gapIn, useColoredCard, cardPadIn, cardRadiusIn,
        });
      }
    }
  }

  return doc.output('blob');
}

interface DrawLabelParams {
  bin: Bin;
  contentX: number;
  contentY: number;
  contentW: number;
  contentH: number;
  qrSize: number;
  qrDataUrl: string | null;
  hasIcon: boolean;
  iconMap: Map<string, string>;
  iconSizeIn: number;
  colorPreset: ReturnType<typeof resolveColor>;
  barHeightIn: number;
  codeFontSizePt: number;
  nameFontSizePt: number;
  contentFontSizePt: number;
  labelOptions: LabelOptions;
  gapIn: number;
  useColoredCard: boolean;
  cardPadIn: number;
  cardRadiusIn: number;
}

function drawLandscapeLabel(doc: import('jspdf').jsPDF, p: DrawLabelParams) {
  let qrEndX = p.contentX;
  const codeUnderQr = !!p.qrDataUrl && p.labelOptions.showBinCode && !!p.bin.id;

  if (p.useColoredCard && p.qrDataUrl) {
    // Card layout mode: rounded rect wrapping QR + short code
    const qrCodeFontSizePt = computeQrCodeFontSize(p.qrSize);
    const codeHeightIn = codeUnderQr ? qrCodeFontSizePt / 72 : 0;
    // Clamp card padding so the card never exceeds the content area height
    const cardPadIn = Math.min(p.cardPadIn, Math.max(0, (p.contentH - p.qrSize - codeHeightIn) / 2));
    const cardContentH = p.qrSize + codeHeightIn;
    const cardW = p.qrSize + cardPadIn * 2;
    const cardH = cardContentH + cardPadIn * 2;
    const cardY = p.contentY + (p.contentH - cardH) / 2;

    // Draw rounded rect fill only if bin has a color
    if (p.colorPreset) {
      const [r, g, b] = hexToRgb(p.colorPreset.bg);
      doc.setFillColor(r, g, b);
      doc.roundedRect(p.contentX, cardY, cardW, cardH, p.cardRadiusIn, p.cardRadiusIn, 'F');
    }

    // QR inside card
    const qrX = p.contentX + cardPadIn;
    const qrY = cardY + cardPadIn;
    doc.addImage(p.qrDataUrl, 'PNG', qrX, qrY, p.qrSize, p.qrSize);

    // Icon overlay
    if (p.hasIcon) {
      const iconDataUrl = p.iconMap.get(p.bin.icon);
      if (iconDataUrl) {
        const circleR = p.qrSize * 0.15;
        const cx = qrX + p.qrSize / 2;
        const cy = qrY + p.qrSize / 2;
        if (p.colorPreset) {
          const [r, g, b] = hexToRgb(p.colorPreset.bg);
          doc.setFillColor(r, g, b);
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.circle(cx, cy, circleR, 'F');
        const iconDrawSize = circleR * 1.4;
        doc.addImage(iconDataUrl, 'PNG', cx - iconDrawSize / 2, cy - iconDrawSize / 2, iconDrawSize, iconDrawSize);
      }
    }

    // Short code inside card (always black)
    if (codeUnderQr) {
      drawCodeUnderQr(doc, p.bin.id, qrX, qrY + p.qrSize, p.qrSize, qrCodeFontSizePt);
    }

    qrEndX = p.contentX + cardW + p.gapIn;

    // Text column with boosted name
    const textX = qrEndX;
    const textW = p.contentX + p.contentW - textX;
    drawTextColumn(doc, p, textX, textW, false, undefined, true);
  } else if (p.qrDataUrl) {
    // Non-colored QR path
    const qrCodeFontSizePt = computeQrCodeFontSize(p.qrSize);
    const codeHeightIn = codeUnderQr ? qrCodeFontSizePt / 72 : 0;
    const blockH = p.qrSize + codeHeightIn;
    const blockY = p.contentY + (p.contentH - blockH) / 2;

    doc.addImage(p.qrDataUrl, 'PNG', p.contentX, blockY, p.qrSize, p.qrSize);

    // Icon overlay in center of QR
    if (p.hasIcon) {
      const iconDataUrl = p.iconMap.get(p.bin.icon);
      if (iconDataUrl) {
        const circleR = p.qrSize * 0.15;
        const cx = p.contentX + p.qrSize / 2;
        const cy = blockY + p.qrSize / 2;
        doc.setFillColor(255, 255, 255);
        doc.circle(cx, cy, circleR, 'F');
        const iconDrawSize = circleR * 1.4;
        doc.addImage(iconDataUrl, 'PNG', cx - iconDrawSize / 2, cy - iconDrawSize / 2, iconDrawSize, iconDrawSize);
      }
    }

    // Short code under QR
    if (codeUnderQr) {
      drawCodeUnderQr(doc, p.bin.id, p.contentX, blockY + p.qrSize, p.qrSize, qrCodeFontSizePt);
    }

    qrEndX = p.contentX + p.qrSize + p.gapIn;

    const textX = qrEndX;
    const textW = p.contentX + p.contentW - textX;
    drawTextColumn(doc, p, textX, textW, false, undefined, codeUnderQr);
  } else {
    if (p.hasIcon && !p.labelOptions.showQrCode) {
      // Icon only (no QR) — draw standalone icon
      const iconDataUrl = p.iconMap.get(p.bin.icon);
      if (iconDataUrl) {
        const iconY = p.contentY + (p.contentH - p.iconSizeIn) / 2;
        doc.addImage(iconDataUrl, 'PNG', p.contentX, iconY, p.iconSizeIn, p.iconSizeIn);
        qrEndX = p.contentX + p.iconSizeIn + p.gapIn;
      }
    }

    const textX = qrEndX;
    const textW = p.contentX + p.contentW - textX;
    drawTextColumn(doc, p, textX, textW, false, undefined, false);
  }
}

function drawPortraitLabel(doc: import('jspdf').jsPDF, p: DrawLabelParams) {
  let currentY = p.contentY;
  const codeUnderQr = !!p.qrDataUrl && p.labelOptions.showBinCode && !!p.bin.id;

  if (p.useColoredCard && p.qrDataUrl) {
    // Card layout mode
    const qrCodeFontSizePt = computeQrCodeFontSize(p.qrSize);
    const codeHeightIn = codeUnderQr ? qrCodeFontSizePt / 72 : 0;
    // Clamp card padding so the card never exceeds the content area height
    const cardPadIn = Math.min(p.cardPadIn, Math.max(0, (p.contentH - p.qrSize - codeHeightIn) / 2));
    const cardContentH = p.qrSize + codeHeightIn;
    const cardW = p.qrSize + cardPadIn * 2;
    const cardH = cardContentH + cardPadIn * 2;
    const cardX = p.contentX + (p.contentW - cardW) / 2;

    // Draw rounded rect fill only if bin has a color
    if (p.colorPreset) {
      const [r, g, b] = hexToRgb(p.colorPreset.bg);
      doc.setFillColor(r, g, b);
      doc.roundedRect(cardX, currentY, cardW, cardH, p.cardRadiusIn, p.cardRadiusIn, 'F');
    }

    // QR inside card
    const qrX = cardX + cardPadIn;
    const qrY = currentY + cardPadIn;
    doc.addImage(p.qrDataUrl, 'PNG', qrX, qrY, p.qrSize, p.qrSize);

    // Icon overlay
    if (p.hasIcon) {
      const iconDataUrl = p.iconMap.get(p.bin.icon);
      if (iconDataUrl) {
        const circleR = p.qrSize * 0.15;
        const cx = qrX + p.qrSize / 2;
        const cy = qrY + p.qrSize / 2;
        if (p.colorPreset) {
          const [r, g, b] = hexToRgb(p.colorPreset.bg);
          doc.setFillColor(r, g, b);
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.circle(cx, cy, circleR, 'F');
        const iconDrawSize = circleR * 1.4;
        doc.addImage(iconDataUrl, 'PNG', cx - iconDrawSize / 2, cy - iconDrawSize / 2, iconDrawSize, iconDrawSize);
      }
    }

    // Short code inside card (always black)
    if (codeUnderQr) {
      drawCodeUnderQr(doc, p.bin.id, qrX, qrY + p.qrSize, p.qrSize, qrCodeFontSizePt);
    }

    currentY += cardH + 2 / 72; // 2pt gap after card

    // Text column with boosted name
    drawTextColumn(doc, p, p.contentX, p.contentW, true, currentY, true);
  } else if (p.qrDataUrl) {
    // Non-colored QR path
    const qrX = p.contentX + (p.contentW - p.qrSize) / 2;
    doc.addImage(p.qrDataUrl, 'PNG', qrX, currentY, p.qrSize, p.qrSize);

    // Icon overlay
    if (p.hasIcon) {
      const iconDataUrl = p.iconMap.get(p.bin.icon);
      if (iconDataUrl) {
        const circleR = p.qrSize * 0.15;
        const cx = qrX + p.qrSize / 2;
        const cy = currentY + p.qrSize / 2;
        doc.setFillColor(255, 255, 255);
        doc.circle(cx, cy, circleR, 'F');
        const iconDrawSize = circleR * 1.4;
        doc.addImage(iconDataUrl, 'PNG', cx - iconDrawSize / 2, cy - iconDrawSize / 2, iconDrawSize, iconDrawSize);
      }
    }

    currentY += p.qrSize;

    // Short code under QR
    if (codeUnderQr) {
      const qrCodeFontSizePt = computeQrCodeFontSize(p.qrSize);
      drawCodeUnderQr(doc, p.bin.id, qrX, currentY, p.qrSize, qrCodeFontSizePt);
      currentY += qrCodeFontSizePt / 72;
    }

    currentY += 2 / 72; // 2pt gap

    drawTextColumn(doc, p, p.contentX, p.contentW, true, currentY, codeUnderQr);
  } else {
    if (p.hasIcon && !p.labelOptions.showQrCode) {
      const iconDataUrl = p.iconMap.get(p.bin.icon);
      if (iconDataUrl) {
        const iconX = p.contentX + (p.contentW - p.iconSizeIn) / 2;
        doc.addImage(iconDataUrl, 'PNG', iconX, currentY, p.iconSizeIn, p.iconSizeIn);
        currentY += p.iconSizeIn + 2 / 72;
      }
    }

    drawTextColumn(doc, p, p.contentX, p.contentW, true, currentY, false);
  }
}

/** Compute font size (pt) so 6 monospace chars fill the QR width. */
function computeQrCodeFontSize(qrSizeIn: number): number {
  const qrSizePt = qrSizeIn * 72;
  return qrSizePt / (6 * 0.6 + 5 * 0.2);
}

/** Draw the short code centered under the QR image. */
function drawCodeUnderQr(doc: import('jspdf').jsPDF, code: string, qrX: number, codeY: number, qrSizeIn: number, fontSizePt: number, color?: string) {
  doc.setFont('courier', 'bold');
  doc.setFontSize(fontSizePt);
  if (color) {
    const [r, g, b] = hexToRgb(color);
    doc.setTextColor(r, g, b);
  } else {
    doc.setTextColor(0, 0, 0);
  }
  const cellWidthIn = (fontSizePt * 0.8) / 72;
  const totalCodeW = code.length * cellWidthIn;
  const startX = qrX + (qrSizeIn - totalCodeW) / 2 + cellWidthIn / 2;
  const baselineY = codeY + fontSizePt / 72 * 0.8;
  for (let i = 0; i < code.length; i++) {
    doc.text(code[i], startX + i * cellWidthIn, baselineY, { align: 'center' });
  }
  // Reset text color
  doc.setTextColor(0, 0, 0);
}

function drawTextColumn(
  doc: import('jspdf').jsPDF,
  p: DrawLabelParams,
  textX: number,
  textW: number,
  centered: boolean,
  startY?: number,
  codeDrawnUnderQr = false,
) {
  const boostedNamePt = p.useColoredCard ? p.nameFontSizePt * 1.4 : p.nameFontSizePt;

  // Collect text elements to measure total height for vertical centering
  const elements: { type: 'swatch' | 'code' | 'name' | 'area'; height: number }[] = [];
  // No swatch bar in colored card mode — replaced by the card itself
  if (p.colorPreset && !p.useColoredCard) elements.push({ type: 'swatch', height: p.barHeightIn });
  if (p.labelOptions.showBinCode && p.bin.id && !codeDrawnUnderQr) elements.push({ type: 'code', height: p.codeFontSizePt / 72 });
  if (p.labelOptions.showBinName) elements.push({ type: 'name', height: boostedNamePt / 72 });
  if (p.labelOptions.showLocation && p.bin.area_name) elements.push({ type: 'area', height: p.contentFontSizePt / 72 });

  const lineGap = 1 / 72; // 1pt gap between lines
  const totalHeight = elements.reduce((sum, el) => sum + el.height, 0) + Math.max(0, elements.length - 1) * lineGap;

  // Vertical centering in remaining content area
  let curY: number;
  if (startY !== undefined) {
    // Portrait: start from provided Y
    curY = startY;
  } else {
    // Landscape: center vertically
    curY = p.contentY + (p.contentH - totalHeight) / 2;
  }

  const align = centered ? 'center' : 'left';
  const anchorX = centered ? textX + textW / 2 : textX;

  for (const el of elements) {
    if (el.type === 'swatch' && p.colorPreset) {
      const [r, g, b] = hexToRgb(p.colorPreset.bg);
      doc.setFillColor(r, g, b);
      const swatchW = Math.min(textW, textW);
      const swatchX = centered ? textX + (textW - swatchW) / 2 : textX;
      doc.roundedRect(swatchX, curY, swatchW, p.barHeightIn, 1 / 72, 1 / 72, 'F');
      curY += p.barHeightIn + lineGap;
    } else if (el.type === 'code') {
      doc.setFont('courier', 'bold');
      doc.setFontSize(p.codeFontSizePt);
      const code = p.bin.id;
      // Draw each character at uniform intervals for consistent monospace spacing.
      const cellWidthIn = (p.codeFontSizePt * 0.8) / 72;
      const totalCodeW = code.length * cellWidthIn;
      const baselineY = curY + p.codeFontSizePt / 72 * 0.8;
      let startX: number;
      if (centered) {
        startX = textX + (textW - totalCodeW) / 2 + cellWidthIn / 2;
      } else {
        startX = textX + cellWidthIn / 2;
      }
      for (let i = 0; i < code.length; i++) {
        doc.text(code[i], startX + i * cellWidthIn, baselineY, { align: 'center' });
      }
      curY += p.codeFontSizePt / 72 + lineGap;
    } else if (el.type === 'name') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(boostedNamePt);
      const name = truncateToWidth(doc, p.bin.name, textW);
      doc.text(name, anchorX, curY + boostedNamePt / 72 * 0.8, { align });
      curY += boostedNamePt / 72 + lineGap;
    } else if (el.type === 'area') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(p.contentFontSizePt);
      doc.setTextColor(100, 100, 100);
      const area = truncateToWidth(doc, p.bin.area_name, textW);
      doc.text(area, anchorX, curY + p.contentFontSizePt / 72 * 0.8, { align });
      doc.setTextColor(0, 0, 0);
      curY += p.contentFontSizePt / 72 + lineGap;
    }
  }
}
