import { resolveColor } from '@/lib/colorPalette';
import type { Bin } from '@/types';
import type { LabelFormat } from './labelFormats';
import { computeCellBleed, computeLabelsPerPage, computePageSize, computeRowsPerPage, getColumnGap, getRowGap } from './labelFormats';
import { computeNameFontSize, computeUniformFontSize, ICON_GAP_RATIO, ICON_SCALE, maxPaddingPt, NAME_CARD_NEUTRAL_BG } from './nameCardLayout';
import { setFillHex } from './pdfColor';
import type { NameCardOptions } from './usePrintSettings';

type JsPDF = import('jspdf').jsPDF;

interface GenerateNamePDFParams {
  bins: Bin[];
  format: LabelFormat;
  nameCardOptions: NameCardOptions;
  iconMap: Map<string, string>;
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

export async function generateNamePDF(params: GenerateNamePDFParams): Promise<Blob> {
  const { bins, format, nameCardOptions, iconMap } = params;
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
  const colGap = getColumnGap(format);
  const rowGap = getRowGap(format);
  const rowsPerPage = computeRowsPerPage(format);
  const paddingPt = maxPaddingPt(format.padding);
  const padIn = paddingPt / 72;
  const cellWPt = cellW * 72;
  const cellHPt = cellH * 72;

  // Pre-compute uniform font size if needed, then apply font scale
  const fontScale = nameCardOptions.fontScale ?? 1;
  const uniformFontSizePt = nameCardOptions.sizingMode === 'uniform'
    ? computeUniformFontSize(bins, cellWPt, cellHPt, paddingPt, nameCardOptions.showIcon) * fontScale
    : undefined;

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    if (pageIdx > 0) doc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'landscape' : 'portrait');

    const pageBins = pages[pageIdx];
    for (let binIdx = 0; binIdx < pageBins.length; binIdx++) {
      const bin = pageBins[binIdx];
      const col = binIdx % format.columns;
      const row = Math.floor(binIdx / format.columns);

      const cellX = marginLeft + col * (cellW + colGap);
      const cellY = marginTop + row * (cellH + rowGap);
      const contentX = cellX + padIn;
      const contentY = cellY + padIn;
      const contentW = cellW - 2 * padIn;
      const contentH = cellH - 2 * padIn;

      const displayName = bin.name || bin.short_code;
      const colorPreset = nameCardOptions.showColor && bin.color ? resolveColor(bin.color) : undefined;
      const hasIcon = nameCardOptions.showIcon && !!bin.icon;

      const bleed = computeCellBleed(format, row, col, rowsPerPage);
      setFillHex(doc, colorPreset?.bg ?? NAME_CARD_NEUTRAL_BG);
      doc.rect(
        cellX - bleed.left,
        cellY - bleed.top,
        cellW + bleed.left + bleed.right,
        cellH + bleed.top + bleed.bottom,
        'F',
      );

      // Compute font size
      const { fontSizePt, iconSizePt } = uniformFontSizePt != null
        ? { fontSizePt: uniformFontSizePt, iconSizePt: uniformFontSizePt * ICON_SCALE }
        : computeNameFontSize({ cellWidthPt: cellWPt, cellHeightPt: cellHPt, paddingPt, name: displayName, hasIcon });

      const fontSizeIn = fontSizePt / 72;
      const iconSizeIn = iconSizePt / 72;
      const gapIn = (fontSizePt * ICON_GAP_RATIO) / 72;

      // Resolve icon data URL once
      const iconDataUrl = hasIcon ? iconMap.get(bin.icon) : undefined;
      const iconWidth = iconDataUrl ? iconSizeIn + gapIn : 0;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSizePt);

      const truncatedName = truncateToWidth(doc, displayName, contentW - iconWidth);
      const textW = doc.getTextWidth(truncatedName);
      const totalW = iconWidth + textW;

      // Center the whole group (icon + text) in the content area
      const startX = contentX + (contentW - totalW) / 2;
      const centerY = contentY + contentH / 2;

      if (iconDataUrl) {
        doc.addImage(iconDataUrl, 'PNG', startX, centerY - iconSizeIn / 2, iconSizeIn, iconSizeIn);
      }

      // Draw text — baseline is approx 0.35 * fontSize below center
      const textX = startX + iconWidth;
      const textY = centerY + fontSizeIn * 0.35;
      doc.text(truncatedName, textX, textY);
    }
  }

  return doc.output('blob');
}
