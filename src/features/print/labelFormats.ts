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
    nameFontSize: '9pt',
    contentFontSize: '7pt',
    codeFontSize: '8pt',
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
    nameFontSize: '12pt',
    contentFontSize: '9pt',
    codeFontSize: '10pt',
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
    nameFontSize: '6pt',
    contentFontSize: '5pt',
    codeFontSize: '5.5pt',
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
    nameFontSize: '9pt',
    contentFontSize: '7pt',
    codeFontSize: '8pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.5in',
    pageMarginRight: '0.5in',
  },
];

export const DEFAULT_LABEL_FORMAT = 'avery-5160';

const PRESETS_STORAGE_KEY = 'sanduk-label-presets';

export function getSavedPresets(): LabelFormat[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function savePreset(preset: LabelFormat): void {
  const presets = getSavedPresets();
  presets.push(preset);
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

export function deletePreset(key: string): void {
  const presets = getSavedPresets().filter((p) => p.key !== key);
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

export function getLabelFormat(key: string): LabelFormat {
  const all = [...LABEL_FORMATS, ...getSavedPresets()];
  return all.find((f) => f.key === key) ?? LABEL_FORMATS[0];
}
