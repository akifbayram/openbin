import type { LabelFormat } from './labelFormats';

/** Compute the scale factor from a base label to a custom-sized label. */
export function computeScaleFactor(base: LabelFormat, custom: LabelFormat): number {
  const baseW = parseFloat(base.cellWidth);
  const baseH = parseFloat(base.cellHeight);
  const customW = parseFloat(custom.cellWidth);
  const customH = parseFloat(custom.cellHeight);
  if (!baseW || !baseH) return 1;
  return Math.min(customW / baseW, customH / baseH);
}

/** Scale a CSS value string (e.g. "8pt 12pt") by the given factor. */
export function scaleValue(value: string, factor: number): string {
  return value
    .split(/\s+/)
    .map((part) => {
      const num = parseFloat(part);
      if (isNaN(num)) return part;
      const unit = part.replace(/^[\d.]+/, '');
      const scaled = (num * factor).toFixed(2).replace(/\.?0+$/, '');
      return `${scaled}${unit}`;
    })
    .join(' ');
}

/** Auto-scale font sizes and padding from the base format to match custom dimensions. */
export function applyAutoScale(base: LabelFormat, custom: LabelFormat): LabelFormat {
  const factor = computeScaleFactor(base, custom);
  if (factor === 1) return custom;
  return {
    ...custom,
    nameFontSize: scaleValue(base.nameFontSize, factor),
    contentFontSize: scaleValue(base.contentFontSize, factor),
    codeFontSize: scaleValue(base.codeFontSize, factor),
    padding: scaleValue(base.padding, factor),
  };
}

/** Apply a font-size multiplier to name, content, and code fonts. */
export function applyFontScale(fmt: LabelFormat, scale: number): LabelFormat {
  if (scale === 1) return fmt;
  return {
    ...fmt,
    nameFontSize: scaleValue(fmt.nameFontSize, scale),
    contentFontSize: scaleValue(fmt.contentFontSize, scale),
    codeFontSize: scaleValue(fmt.codeFontSize, scale),
  };
}
