import type { LabelFormat } from './labelFormats';
import { applyOrientation, getLabelFormat, getOrientation } from './labelFormats';
import { applyAutoScale, applyFontScale, computeScaleFactor } from './labelScaling';
import type { CustomState } from './usePrintSettings';

export interface EffectiveFormatResult {
  /** The base format before orientation/customization */
  baseFormat: LabelFormat;
  /** The oriented base (before custom overrides) */
  orientedBase: LabelFormat;
  /** The final format after all transformations */
  labelFormat: LabelFormat;
  /** Icon size CSS string (scaled when customizing) */
  iconSize: string;
  /** Resolved orientation (explicit or from base format) */
  effectiveOrientation: 'landscape' | 'portrait';
}

/**
 * Pure computation chain: base → oriented → custom → scaled → font-scaled.
 * Extracted for testability and separation of concerns.
 */
export function computeEffectiveFormat(
  formatKey: string,
  orientation: 'landscape' | 'portrait' | undefined,
  customState: CustomState,
  fontScale: number,
  savedPresets: LabelFormat[],
): EffectiveFormatResult {
  const baseFormat = getLabelFormat(formatKey, savedPresets);
  const orientedBase = applyOrientation(baseFormat, orientation);
  const customFormat = customState.customizing
    ? { ...orientedBase, ...customState.overrides }
    : orientedBase;
  const scaledFormat = customState.customizing
    ? applyAutoScale(orientedBase, customFormat)
    : customFormat;
  const labelFormat = applyFontScale(scaledFormat, fontScale);
  const iconSize = customState.customizing
    ? `${(11 * computeScaleFactor(orientedBase, customFormat)).toFixed(2).replace(/\.?0+$/, '')}pt`
    : '11pt';
  const effectiveOrientation = orientation ?? getOrientation(baseFormat);

  return { baseFormat, orientedBase, labelFormat, iconSize, effectiveOrientation };
}
