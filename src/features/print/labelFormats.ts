export interface LabelFormat {
  key: string;
  name: string;
  columns: number;
  cellWidth: string;
  cellHeight: string;
  qrSize: string;
  padding: string;
  nameFontSize: string;
  contentFontSize: string;
  codeFontSize: string;
  pageMarginTop: string;
  pageMarginBottom: string;
  pageMarginLeft: string;
  pageMarginRight: string;
  orientation?: 'landscape' | 'portrait';
  pageWidth?: number; // inches; defaults to computed tight-fit
  pageHeight?: number; // inches; defaults to 11 (US Letter)
}

export function getOrientation(fmt: LabelFormat): 'landscape' | 'portrait' {
  return fmt.orientation ?? 'landscape';
}

export const LABEL_FORMATS: LabelFormat[] = [
  {
    key: 'avery-5160',
    name: 'Avery 5160',
    columns: 3,
    cellWidth: '2.625in',
    cellHeight: '1in',
    qrSize: '0.75in',
    padding: '2pt 4pt',
    nameFontSize: '8pt',
    contentFontSize: '6.5pt',
    codeFontSize: '14pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.1875in',
    pageMarginRight: '0.1875in',
  },
  {
    key: 'avery-5163',
    name: 'Avery 5163',
    columns: 2,
    cellWidth: '4in',
    cellHeight: '2in',
    qrSize: '1.5in',
    padding: '6pt 8pt',
    nameFontSize: '11pt',
    contentFontSize: '8pt',
    codeFontSize: '18pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.15625in',
    pageMarginRight: '0.15625in',
  },
  {
    key: 'avery-5444',
    name: 'Avery 5444 (4"×6")',
    columns: 1,
    cellWidth: '4in',
    cellHeight: '2in',
    qrSize: '1.5in',
    padding: '6pt 4pt',
    nameFontSize: '10pt',
    contentFontSize: '7.5pt',
    codeFontSize: '14pt',
    pageMarginTop: '1in',
    pageMarginBottom: '1in',
    pageMarginLeft: '0in',
    pageMarginRight: '0in',
    orientation: 'landscape',
    pageWidth: 4,
    pageHeight: 6,
  },
  {
    key: 'avery-5454',
    name: 'Avery 5454 (4"×6")',
    columns: 1,
    cellWidth: '6in',
    cellHeight: '4in',
    qrSize: '2in',
    padding: '8pt 8pt',
    nameFontSize: '14pt',
    contentFontSize: '10pt',
    codeFontSize: '24pt',
    pageMarginTop: '0in',
    pageMarginBottom: '0in',
    pageMarginLeft: '0in',
    pageMarginRight: '0in',
    orientation: 'landscape',
    pageHeight: 4,
  },
  {
    key: 'avery-6464',
    name: 'Avery 6464',
    columns: 2,
    cellWidth: '4in',
    cellHeight: '3.3333in',
    qrSize: '1.5in',
    padding: '6pt 8pt',
    nameFontSize: '11pt',
    contentFontSize: '8pt',
    codeFontSize: '18pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.15625in',
    pageMarginRight: '0.15625in',
  },
  {
    key: 'avery-5167',
    name: 'Avery 5167',
    columns: 4,
    cellWidth: '1.75in',
    cellHeight: '0.5in',
    qrSize: '0.35in',
    padding: '1pt 2pt',
    nameFontSize: '5.5pt',
    contentFontSize: '4.5pt',
    codeFontSize: '8pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.3125in',
    pageMarginRight: '0.3125in',
  },
  {
    key: 'generic-2x1',
    name: '2"×1" Generic',
    columns: 1,
    cellWidth: '2in',
    cellHeight: '1in',
    qrSize: '0.75in',
    padding: '2pt 4pt',
    nameFontSize: '8pt',
    contentFontSize: '6.5pt',
    codeFontSize: '14pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.5in',
    pageMarginRight: '0.5in',
  },
];

export const DEFAULT_LABEL_FORMAT = 'avery-5160';

export function getLabelFormat(key: string, customPresets?: LabelFormat[]): LabelFormat {
  const all = [...LABEL_FORMATS, ...(customPresets ?? [])];
  return all.find((f) => f.key === key) ?? LABEL_FORMATS[0];
}

const PAGE_HEIGHT_INCHES = 11; // US Letter

export function computeRowsPerPage(format: LabelFormat): number {
  const pageHeight = format.pageHeight ?? PAGE_HEIGHT_INCHES;
  const available = pageHeight - parseFloat(format.pageMarginTop) - parseFloat(format.pageMarginBottom);
  return Math.max(1, Math.floor(available / parseFloat(format.cellHeight)));
}

export function computeLabelsPerPage(format: LabelFormat): number {
  return computeRowsPerPage(format) * format.columns;
}

export function computePageSize(format: LabelFormat): { width: number; height: number } {
  const rows = computeRowsPerPage(format);
  const computedWidth = parseFloat(format.pageMarginLeft) + format.columns * parseFloat(format.cellWidth) + parseFloat(format.pageMarginRight);
  const computedHeight = parseFloat(format.pageMarginTop) + rows * parseFloat(format.cellHeight) + parseFloat(format.pageMarginBottom);
  return {
    width: format.pageWidth ?? computedWidth,
    height: format.pageHeight ?? computedHeight,
  };
}

/** Compute optimal code font size (pt) to fill available horizontal space. */
export function computeCodeFontSize(format: LabelFormat): number {
  const cellH = parseFloat(format.cellHeight) * 72; // inches -> pt
  const floor = parseFloat(format.codeFontSize);
  const cap = 0.25 * cellH;

  const cellW = parseFloat(format.cellWidth) * 72;
  const qrW = parseFloat(format.qrSize) * 72;
  const padParts = format.padding.split(/\s+/).map((p) => parseFloat(p));
  const padH = (padParts[1] ?? padParts[0]) * 2; // left + right padding
  const isPortrait = getOrientation(format) === 'portrait';
  const gap = 4; // gap between QR and content (pt)
  // In portrait mode QR is above text, so full cell width is available
  const availW = isPortrait ? cellW - padH : cellW - qrW - padH - gap;

  // 6 monospace chars: each ~0.6em wide + 0.2em letter-spacing per gap (5 gaps)
  const charWidthEms = 6 * 0.6 + 5 * 0.2;
  const computed = availW / charWidthEms;

  return Math.max(floor, Math.min(computed, cap));
}
