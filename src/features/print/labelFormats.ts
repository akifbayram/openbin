import type { Bin } from '@/types';
import type { QRColorOptions } from '@/lib/qr';
import { resolveColor } from '@/lib/colorPalette';
import { MONO_CODE_WIDTH_EMS } from './pdfConstants';

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
    key: 'avery-5126',
    name: 'Avery 5126',
    columns: 1,
    cellWidth: '8.5in',
    cellHeight: '5.5in',
    qrSize: '4in',
    padding: '12pt 16pt',
    nameFontSize: '16pt',
    contentFontSize: '11pt',
    codeFontSize: '28pt',
    pageMarginTop: '0in',
    pageMarginBottom: '0in',
    pageMarginLeft: '0in',
    pageMarginRight: '0in',
    pageWidth: 8.5,
    pageHeight: 11,
  },
  {
    key: 'avery-5160',
    name: 'Avery 5160',
    columns: 3,
    cellWidth: '2.633in',
    cellHeight: '1in',
    qrSize: '0.75in',
    padding: '2pt 4pt',
    nameFontSize: '8pt',
    contentFontSize: '6.5pt',
    codeFontSize: '14pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.3in',
    pageMarginRight: '0.3in',
    pageWidth: 8.5,
    pageHeight: 11,
  },
  {
    key: 'avery-5163',
    name: 'Avery 5163',
    columns: 2,
    cellWidth: '4.083in',
    cellHeight: '2in',
    qrSize: '1.4in',
    padding: '6pt 12pt',
    nameFontSize: '11pt',
    contentFontSize: '8pt',
    codeFontSize: '18pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.167in',
    pageMarginRight: '0.167in',
    pageWidth: 8.5,
    pageHeight: 11,
  },
  {
    key: 'avery-5444',
    name: 'Avery 5444 (4"×6")',
    columns: 1,
    cellWidth: '4in',
    cellHeight: '2.375in',
    qrSize: '1.5in',
    padding: '14pt 4pt',
    nameFontSize: '10pt',
    contentFontSize: '7.5pt',
    codeFontSize: '14pt',
    pageMarginTop: '0.625in',
    pageMarginBottom: '0.625in',
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
    pageWidth: 6,
  },
  {
    key: 'avery-5164',
    name: 'Avery 5164 / 6464',
    columns: 2,
    cellWidth: '4.094in',
    cellHeight: '3.3333in',
    qrSize: '1.5in',
    padding: '6pt 12pt',
    nameFontSize: '11pt',
    contentFontSize: '8pt',
    codeFontSize: '18pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.156in',
    pageMarginRight: '0.156in',
    pageWidth: 8.5,
    pageHeight: 11,
  },
  {
    key: 'avery-5168',
    name: 'Avery 5168',
    columns: 2,
    cellWidth: '3.5in',
    cellHeight: '5in',
    qrSize: '1.75in',
    padding: '8pt 10pt',
    nameFontSize: '12pt',
    contentFontSize: '9pt',
    codeFontSize: '20pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.75in',
    pageMarginRight: '0.75in',
    orientation: 'portrait',
    pageWidth: 8.5,
    pageHeight: 11,
  },
  {
    key: 'letter',
    name: 'US Letter (8.5"×11")',
    columns: 1,
    cellWidth: '8.5in',
    cellHeight: '11in',
    qrSize: '5in',
    padding: '16pt 16pt',
    nameFontSize: '18pt',
    contentFontSize: '12pt',
    codeFontSize: '32pt',
    pageMarginTop: '0in',
    pageMarginBottom: '0in',
    pageMarginLeft: '0in',
    pageMarginRight: '0in',
    orientation: 'portrait',
    pageWidth: 8.5,
    pageHeight: 11,
  },
  {
    key: 'a4',
    name: 'A4 (210×297mm)',
    columns: 1,
    cellWidth: '8.27in',
    cellHeight: '11.69in',
    qrSize: '5in',
    padding: '16pt 16pt',
    nameFontSize: '18pt',
    contentFontSize: '12pt',
    codeFontSize: '32pt',
    pageMarginTop: '0in',
    pageMarginBottom: '0in',
    pageMarginLeft: '0in',
    pageMarginRight: '0in',
    orientation: 'portrait',
    pageWidth: 8.27,
    pageHeight: 11.69,
  },
];

export const DEFAULT_LABEL_FORMAT = 'avery-5160';

/**
 * Cross-reference of compatible Avery product numbers per format key.
 * Users can search by any of these numbers to find the matching base format.
 * Source: avery.com/software/template-compatibility
 */
const AVERY_CROSS_REFERENCE: Record<string, string[]> = {
  'avery-5126': ['5126', '8126', '15516', '18126'],
  'avery-5160': ['5160', '5260', '5660', '5810', '5960', '5970', '5971', '5972', '5979', '5980', '6240', '6241', '6460', '6585', '8160', '8250', '8460', '8660', '8810', '15160', '15510', '15660', '15960', '18160', '18260', '18660', '48160', '48260', '48360', '48460', '48860', '55160', '58160', '58660', '75160', '85560', '95520', '95905', '95915', '95940', '95945'],
  'avery-5163': ['5163', '5263', '5663', '5963', '6173', '8163', '8253', '8463', '8663', '15163', '15513', '15563', '15663', '15963', '18163', '18263', '18663', '48263', '48363', '48463', '48863', '55163', '58163', '58663', '75163'],
  'avery-5164': ['5164', '5264', '5664', '5964', '6464', '8164', '8254', '8464', '8664', '15164', '15664', '15964', '18164', '18264', '18664', '48264', '48364', '48464', '48864', '55164', '58164', '58664', '75164'],
  'avery-5168': ['5168', '5268', '5668', '5968', '6478', '8168', '8468', '8668', '15168', '15668', '15968', '18168', '18268', '18668', '48268', '48368', '48468', '48868', '55168', '58168', '58668'],
  'avery-5444': ['5444', '8444'],
  'avery-5454': ['5454', '8454'],
};

export function filterLabelFormats(query: string): LabelFormat[] {
  const q = query.trim().toLowerCase();
  if (!q) return LABEL_FORMATS;
  return LABEL_FORMATS.filter((fmt) => {
    if (fmt.name.toLowerCase().includes(q)) return true;
    if (fmt.key.toLowerCase().includes(q)) return true;
    const refs = AVERY_CROSS_REFERENCE[fmt.key];
    if (refs) return refs.some((num) => num.includes(q));
    return false;
  });
}

export function getLabelFormat(key: string, customPresets?: LabelFormat[]): LabelFormat {
  const all = [...LABEL_FORMATS, ...(customPresets ?? [])];
  return all.find((f) => f.key === key) ?? LABEL_FORMATS[0];
}

const PAGE_HEIGHT_INCHES = 11; // US Letter
export const PAGE_WIDTH_INCHES = 8.5; // US Letter
const EPS = 1e-6;

export function applyOrientation(
  format: LabelFormat,
  target?: 'landscape' | 'portrait',
): LabelFormat {
  if (target === undefined || target === getOrientation(format)) return format;

  const newCellWidth = format.cellHeight;
  const newCellHeight = format.cellWidth;

  // Resolve effective page size before swapping (avoids wrong letter-default fallback)
  const { width: currentWidth, height: currentHeight } = computePageSize(format);
  const newPageWidth = currentHeight;
  const newPageHeight = currentWidth;

  // Swap margins: top/bottom ↔ left/right
  const newMarginTop = format.pageMarginLeft;
  const newMarginBottom = format.pageMarginRight;
  const newMarginLeft = format.pageMarginTop;
  const newMarginRight = format.pageMarginBottom;

  const availableWidth = newPageWidth - parseFloat(newMarginLeft) - parseFloat(newMarginRight);
  const newColumns = Math.max(1, Math.floor(availableWidth / parseFloat(newCellWidth) + EPS));

  return {
    ...format,
    cellWidth: newCellWidth,
    cellHeight: newCellHeight,
    columns: newColumns,
    orientation: target,
    pageWidth: newPageWidth,
    pageHeight: newPageHeight,
    pageMarginTop: newMarginTop,
    pageMarginBottom: newMarginBottom,
    pageMarginLeft: newMarginLeft,
    pageMarginRight: newMarginRight,
  };
}

export function computeRowsPerPage(format: LabelFormat): number {
  const pageHeight = format.pageHeight ?? PAGE_HEIGHT_INCHES;
  const available = pageHeight - parseFloat(format.pageMarginTop) - parseFloat(format.pageMarginBottom);
  return Math.max(1, Math.floor(available / parseFloat(format.cellHeight) + EPS));
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
  const charWidthEms = MONO_CODE_WIDTH_EMS;
  const computed = availW / charWidthEms;

  return Math.max(floor, Math.min(computed, cap));
}

/** Build a color map for QR generation when color background is enabled. */
export function buildColorMap(bins: Bin[], showColorSwatch: boolean): Map<string, QRColorOptions> | undefined {
  if (!showColorSwatch) return undefined;
  const map = new Map<string, QRColorOptions>();
  for (const bin of bins) {
    if (bin.color) {
      const preset = resolveColor(bin.color);
      if (preset) {
        map.set(bin.id, { dark: '#000000', light: preset.bg });
      }
    }
  }
  return map.size > 0 ? map : undefined;
}
