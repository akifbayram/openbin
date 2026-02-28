import type { Bin } from '@/types';
import type { LabelFormat } from './labelFormats';
import { computeLabelsPerPage, computePageSize } from './labelFormats';
import { resolveColor } from '@/lib/colorPalette';
import { toInches, parsePaddingPt } from './pdfUnits';
import type { LabelOptions } from './usePrintSettings';
import { computeLabelLayout } from './labelLayout';
import type { LabelLayoutResult } from './labelLayout';

type JsPDF = import('jspdf').jsPDF;

interface GenerateLabelPDFParams {
  bins: Bin[];
  format: LabelFormat;
  labelOptions: LabelOptions;
  qrMap: Map<string, string>;
  iconMap: Map<string, string>;
  iconSize: string;
}

/** Truncate text to fit within maxWidth, adding ellipsis if needed. */
function truncateToWidth(doc: JsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && doc.getTextWidth(`${truncated}\u2026`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}\u2026`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function setFillHex(doc: JsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}

function setTextHex(doc: JsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

/** Draw icon overlay in the center of a QR code with a circular background. */
function drawIconOverlay(
  doc: JsPDF,
  iconDataUrl: string,
  qrX: number,
  qrY: number,
  qrSize: number,
  bgColor?: string,
): void {
  const circleR = qrSize * 0.15;
  const cx = qrX + qrSize / 2;
  const cy = qrY + qrSize / 2;
  if (bgColor) {
    setFillHex(doc, bgColor);
  } else {
    doc.setFillColor(255, 255, 255);
  }
  doc.circle(cx, cy, circleR, 'F');
  const iconDrawSize = circleR * 1.4;
  doc.addImage(iconDataUrl, 'PNG', cx - iconDrawSize / 2, cy - iconDrawSize / 2, iconDrawSize, iconDrawSize);
}

/** Draw QR image + optional icon overlay + optional short code under QR. */
function drawQrBlock(
  doc: JsPDF,
  p: DrawLabelParams,
  layout: LabelLayoutResult,
  qrX: number,
  qrY: number,
): void {
  doc.addImage(p.qrDataUrl!, 'PNG', qrX, qrY, p.qrSize, p.qrSize);

  if (p.hasIcon) {
    const iconDataUrl = p.iconMap.get(p.bin.icon);
    if (iconDataUrl) drawIconOverlay(doc, iconDataUrl, qrX, qrY, p.qrSize, p.colorPreset?.bg);
  }

  if (layout.codeUnderQr) {
    drawCodeUnderQr(doc, p.bin.id, qrX, qrY + p.qrSize, p.qrSize, layout.qrCodeFontSizePt);
  }
}

export async function generateLabelPDF(params: GenerateLabelPDFParams): Promise<Blob> {
  const { bins, format, labelOptions, qrMap, iconMap, iconSize } = params;
  const { default: jsPDF } = await import('jspdf');

  const perPage = computeLabelsPerPage(format);
  const { width: pageWidth, height: pageHeight } = computePageSize(format);

  const doc = new jsPDF({
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
    unit: 'in',
    format: [pageWidth, pageHeight],
  });

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
  const padIn = { top: pad.top / 72, right: pad.right / 72, bottom: pad.bottom / 72, left: pad.left / 72 };
  const gapIn = 4 / 72;
  const iconSizeIn = toInches(iconSize);

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    if (pageIdx > 0) doc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'landscape' : 'portrait');

    const pageBins = pages[pageIdx];
    for (let binIdx = 0; binIdx < pageBins.length; binIdx++) {
      const bin = pageBins[binIdx];
      const col = binIdx % format.columns;
      const row = Math.floor(binIdx / format.columns);

      const cellX = marginLeft + col * cellW;
      const cellY = marginTop + row * cellH;
      const contentX = cellX + padIn.left;
      const contentY = cellY + padIn.top;
      const contentW = cellW - padIn.left - padIn.right;
      const contentH = cellH - padIn.top - padIn.bottom;

      const qrDataUrl = qrMap.get(bin.id);
      const colorPreset = labelOptions.showColorSwatch && bin.color ? resolveColor(bin.color) : undefined;

      const layout = computeLabelLayout({
        format,
        hasQrData: !!qrDataUrl,
        hasColor: !!bin.color,
        hasCode: !!bin.id,
        hasIcon: !!bin.icon,
        labelDirection: labelOptions.labelDirection,
        showQrCode: labelOptions.showQrCode,
        showBinName: labelOptions.showBinName,
        showIcon: labelOptions.showIcon,
        showBinCode: labelOptions.showBinCode,
        showColorSwatch: labelOptions.showColorSwatch,
      });

      const p: DrawLabelParams = {
        bin, contentX, contentY, contentW, contentH,
        qrSize, qrDataUrl: (labelOptions.showQrCode && qrDataUrl) ? qrDataUrl : null,
        hasIcon: labelOptions.showIcon, iconMap, iconSizeIn,
        colorPreset, labelOptions, gapIn,
        cardRadiusIn: layout.cardRadiusPt / 72,
      };

      if (layout.isPortrait) {
        drawPortraitLabel(doc, p, layout);
      } else {
        drawLandscapeLabel(doc, p, layout);
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
  labelOptions: LabelOptions;
  gapIn: number;
  cardRadiusIn: number;
}

/** Measure the natural width of text column elements (inches). */
function measureTextBlockWidth(doc: JsPDF, p: DrawLabelParams, layout: LabelLayoutResult, codeUnderQr: boolean): number {
  let maxW = 0;
  if (p.labelOptions.showBinCode && p.bin.id && !codeUnderQr) {
    const cellWidthIn = (layout.codeFontSizePt * 0.8) / 72;
    maxW = Math.max(maxW, p.bin.id.length * cellWidthIn);
  }
  if (p.labelOptions.showBinName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(layout.nameFontSizePt);
    maxW = Math.max(maxW, doc.getTextWidth(p.bin.name));
  }
  return maxW;
}

/** Compute horizontal offset to center QR+text block within contentW. */
function computeCenterOffset(contentW: number, leftBlockW: number, gap: number, textNaturalW: number): number {
  const maxTextW = contentW - leftBlockW - gap;
  const textW = Math.min(textNaturalW, maxTextW);
  const totalW = leftBlockW + gap + textW;
  return Math.max(0, (contentW - totalW) / 2);
}

function drawLandscapeLabel(doc: JsPDF, p: DrawLabelParams, layout: LabelLayoutResult) {
  const isLeftAligned = p.labelOptions.textAlign === 'left';
  const cardPadIn = layout.cardPaddingPt / 72;
  const codeHeightIn = layout.codeUnderQr ? layout.qrCodeFontSizePt / 72 : 0;

  if (layout.mode === 'colored-card' && p.qrDataUrl) {
    const cardW = p.qrSize + cardPadIn * 2;
    const cardH = p.qrSize + codeHeightIn + cardPadIn * 2;
    const cardY = p.contentY + (p.contentH - cardH) / 2;

    const textNaturalW = measureTextBlockWidth(doc, p, layout, true);
    const offsetX = isLeftAligned ? 0 : computeCenterOffset(p.contentW, cardW, p.gapIn, textNaturalW);
    const baseX = p.contentX + offsetX;

    if (p.colorPreset) {
      setFillHex(doc, p.colorPreset.bg);
      doc.roundedRect(baseX, cardY, cardW, cardH, p.cardRadiusIn, p.cardRadiusIn, 'F');
    }

    drawQrBlock(doc, p, layout, baseX + cardPadIn, cardY + cardPadIn);

    const textX = baseX + cardW + p.gapIn;
    const textW = Math.min(textNaturalW, p.contentW - cardW - p.gapIn);
    drawTextColumn(doc, p, layout, textX, textW, false, undefined, true);
  } else if (layout.mode === 'plain-qr' && p.qrDataUrl) {
    const blockH = p.qrSize + codeHeightIn;
    const textNaturalW = measureTextBlockWidth(doc, p, layout, layout.codeUnderQr);
    const offsetX = isLeftAligned ? 0 : computeCenterOffset(p.contentW, p.qrSize, p.gapIn, textNaturalW);
    const baseX = p.contentX + offsetX;
    const blockY = p.contentY + (p.contentH - blockH) / 2;

    drawQrBlock(doc, p, layout, baseX, blockY);

    const textX = baseX + p.qrSize + p.gapIn;
    const textW = Math.min(textNaturalW, p.contentW - p.qrSize - p.gapIn);
    drawTextColumn(doc, p, layout, textX, textW, false, undefined, layout.codeUnderQr);
  } else {
    let leftBlockW = 0;
    if (p.hasIcon && !p.labelOptions.showQrCode) {
      const iconDataUrl = p.iconMap.get(p.bin.icon);
      if (iconDataUrl) leftBlockW = p.iconSizeIn;
    }

    const textNaturalW = measureTextBlockWidth(doc, p, layout, false);
    const gap = leftBlockW > 0 ? p.gapIn : 0;
    const offsetX = isLeftAligned ? 0 : computeCenterOffset(p.contentW, leftBlockW, gap, textNaturalW);
    const baseX = p.contentX + offsetX;

    if (leftBlockW > 0) {
      const iconDataUrl = p.iconMap.get(p.bin.icon);
      if (iconDataUrl) {
        const iconY = p.contentY + (p.contentH - p.iconSizeIn) / 2;
        doc.addImage(iconDataUrl, 'PNG', baseX, iconY, p.iconSizeIn, p.iconSizeIn);
      }
    }

    const textX = baseX + leftBlockW + gap;
    const textW = Math.min(textNaturalW, p.contentW - leftBlockW - gap);
    drawTextColumn(doc, p, layout, textX, textW, false, undefined, false);
  }
}

function drawPortraitLabel(doc: JsPDF, p: DrawLabelParams, layout: LabelLayoutResult) {
  let currentY = p.contentY;
  const isLeftAligned = p.labelOptions.textAlign === 'left';
  const centered = !isLeftAligned;
  const cardPadIn = layout.cardPaddingPt / 72;
  const codeHeightIn = layout.codeUnderQr ? layout.qrCodeFontSizePt / 72 : 0;

  if (layout.mode === 'colored-card' && p.qrDataUrl) {
    const cardW = p.qrSize + cardPadIn * 2;
    const cardH = p.qrSize + codeHeightIn + cardPadIn * 2;
    const cardX = isLeftAligned ? p.contentX : p.contentX + (p.contentW - cardW) / 2;

    if (p.colorPreset) {
      setFillHex(doc, p.colorPreset.bg);
      doc.roundedRect(cardX, currentY, cardW, cardH, p.cardRadiusIn, p.cardRadiusIn, 'F');
    }

    drawQrBlock(doc, p, layout, cardX + cardPadIn, currentY + cardPadIn);
    currentY += cardH + 2 / 72;

    drawTextColumn(doc, p, layout, p.contentX, p.contentW, centered, currentY, true);
  } else if (layout.mode === 'plain-qr' && p.qrDataUrl) {
    const qrX = isLeftAligned ? p.contentX : p.contentX + (p.contentW - p.qrSize) / 2;

    drawQrBlock(doc, p, layout, qrX, currentY);
    currentY += p.qrSize;

    if (layout.codeUnderQr) {
      currentY += layout.qrCodeFontSizePt / 72;
    }
    currentY += 2 / 72;

    drawTextColumn(doc, p, layout, p.contentX, p.contentW, centered, currentY, layout.codeUnderQr);
  } else {
    if (p.hasIcon && !p.labelOptions.showQrCode) {
      const iconDataUrl = p.iconMap.get(p.bin.icon);
      if (iconDataUrl) {
        const iconX = isLeftAligned ? p.contentX : p.contentX + (p.contentW - p.iconSizeIn) / 2;
        doc.addImage(iconDataUrl, 'PNG', iconX, currentY, p.iconSizeIn, p.iconSizeIn);
        currentY += p.iconSizeIn + 2 / 72;
      }
    }

    drawTextColumn(doc, p, layout, p.contentX, p.contentW, centered, currentY, false);
  }
}

/** Draw the short code centered under the QR image. */
function drawCodeUnderQr(doc: JsPDF, code: string, qrX: number, codeY: number, qrSizeIn: number, fontSizePt: number, color?: string) {
  doc.setFont('courier', 'bold');
  doc.setFontSize(fontSizePt);
  if (color) {
    setTextHex(doc, color);
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
  doc.setTextColor(0, 0, 0);
}

function drawTextColumn(
  doc: JsPDF,
  p: DrawLabelParams,
  layout: LabelLayoutResult,
  textX: number,
  textW: number,
  centered: boolean,
  startY?: number,
  codeDrawnUnderQr = false,
) {
  const barHeightIn = layout.swatchBarHeightPt / 72;
  const elements: { type: 'swatch' | 'code' | 'name'; height: number }[] = [];
  if (layout.showSwatchBar && p.colorPreset) elements.push({ type: 'swatch', height: barHeightIn });
  if (p.labelOptions.showBinCode && p.bin.id && !codeDrawnUnderQr) elements.push({ type: 'code', height: layout.codeFontSizePt / 72 });
  if (p.labelOptions.showBinName) elements.push({ type: 'name', height: layout.nameFontSizePt / 72 });

  const lineGap = 1 / 72;
  const totalHeight = elements.reduce((sum, el) => sum + el.height, 0) + Math.max(0, elements.length - 1) * lineGap;

  let curY: number;
  if (startY !== undefined) {
    curY = startY;
  } else {
    curY = p.contentY + (p.contentH - totalHeight) / 2;
  }

  const align = centered ? 'center' : 'left';
  const anchorX = centered ? textX + textW / 2 : textX;

  for (const el of elements) {
    if (el.type === 'swatch' && p.colorPreset) {
      setFillHex(doc, p.colorPreset.bg);
      const swatchX = centered ? textX + (textW - textW) / 2 : textX;
      doc.roundedRect(swatchX, curY, textW, barHeightIn, 1 / 72, 1 / 72, 'F');
      curY += barHeightIn + lineGap;
    } else if (el.type === 'code') {
      doc.setFont('courier', 'bold');
      doc.setFontSize(layout.codeFontSizePt);
      const code = p.bin.id;
      const cellWidthIn = (layout.codeFontSizePt * 0.8) / 72;
      const totalCodeW = code.length * cellWidthIn;
      const baselineY = curY + layout.codeFontSizePt / 72 * 0.8;
      let startX: number;
      if (centered) {
        startX = textX + (textW - totalCodeW) / 2 + cellWidthIn / 2;
      } else {
        startX = textX + cellWidthIn / 2;
      }
      for (let i = 0; i < code.length; i++) {
        doc.text(code[i], startX + i * cellWidthIn, baselineY, { align: 'center' });
      }
      curY += layout.codeFontSizePt / 72 + lineGap;
    } else if (el.type === 'name') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(layout.nameFontSizePt);
      const name = truncateToWidth(doc, p.bin.name, textW);
      doc.text(name, anchorX, curY + layout.nameFontSizePt / 72 * 0.8, { align });
      curY += layout.nameFontSizePt / 72 + lineGap;
    }
  }
}
