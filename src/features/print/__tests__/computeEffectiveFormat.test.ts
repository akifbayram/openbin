import { describe, expect, it } from 'vitest';
import { computeEffectiveFormat } from '../computeEffectiveFormat';
import type { LabelFormat } from '../labelFormats';
import { getOrientation, LABEL_FORMATS } from '../labelFormats';
import type { CustomState } from '../usePrintSettings';

// biome-ignore lint/style/noNonNullAssertion: test assertion
const avery5160 = LABEL_FORMATS.find((f) => f.key === 'avery-5160')!;

const NO_CUSTOM: CustomState = { customizing: false, overrides: {} };

describe('computeEffectiveFormat', () => {
  it('returns the base format unchanged when not customizing', () => {
    const result = computeEffectiveFormat('avery-5160', undefined, NO_CUSTOM, 1, []);
    expect(result.baseFormat.key).toBe('avery-5160');
    expect(result.labelFormat.cellWidth).toBe(avery5160.cellWidth);
    expect(result.labelFormat.nameFontSize).toBe(avery5160.nameFontSize);
    expect(result.iconSize).toBe('11pt');
  });

  it('resolves effective orientation from base format when none specified', () => {
    const result = computeEffectiveFormat('avery-5160', undefined, NO_CUSTOM, 1, []);
    expect(result.effectiveOrientation).toBe(getOrientation(avery5160));
  });

  it('uses explicit orientation override', () => {
    const result = computeEffectiveFormat('avery-5160', 'portrait', NO_CUSTOM, 1, []);
    expect(result.effectiveOrientation).toBe('portrait');
  });

  it('applies orientation swap to cell dimensions', () => {
    const result = computeEffectiveFormat('avery-5160', 'portrait', NO_CUSTOM, 1, []);
    // Portrait swaps width/height
    expect(result.labelFormat.cellWidth).toBe(avery5160.cellHeight);
    expect(result.labelFormat.cellHeight).toBe(avery5160.cellWidth);
  });

  it('applies custom overrides when customizing', () => {
    const customState: CustomState = {
      customizing: true,
      overrides: { cellWidth: '5in', cellHeight: '3in' },
    };
    const result = computeEffectiveFormat('avery-5160', undefined, customState, 1, []);
    expect(result.labelFormat.cellWidth).toBe('5in');
    expect(result.labelFormat.cellHeight).toBe('3in');
  });

  it('auto-scales fonts when customizing with different dimensions', () => {
    const customState: CustomState = {
      customizing: true,
      overrides: { cellWidth: '5.266in', cellHeight: '2in' }, // 2x the avery-5160 size
    };
    const result = computeEffectiveFormat('avery-5160', undefined, customState, 1, []);
    // Font size should be scaled up
    const baseFontPt = parseFloat(avery5160.nameFontSize);
    const resultFontPt = parseFloat(result.labelFormat.nameFontSize);
    expect(resultFontPt).toBeGreaterThan(baseFontPt);
  });

  it('scales icon size when customizing', () => {
    const customState: CustomState = {
      customizing: true,
      overrides: { cellWidth: '5.266in', cellHeight: '2in' },
    };
    const result = computeEffectiveFormat('avery-5160', undefined, customState, 1, []);
    expect(result.iconSize).not.toBe('11pt');
    const iconPt = parseFloat(result.iconSize);
    expect(iconPt).toBeGreaterThan(11);
  });

  it('applies font scale multiplier', () => {
    const result = computeEffectiveFormat('avery-5160', undefined, NO_CUSTOM, 1.5, []);
    const baseFontPt = parseFloat(avery5160.nameFontSize);
    const resultFontPt = parseFloat(result.labelFormat.nameFontSize);
    expect(resultFontPt).toBeCloseTo(baseFontPt * 1.5, 1);
  });

  it('looks up custom presets', () => {
    const preset: LabelFormat = { ...avery5160, key: 'custom-123', name: 'My Preset' };
    const result = computeEffectiveFormat('custom-123', undefined, NO_CUSTOM, 1, [preset]);
    expect(result.baseFormat.key).toBe('custom-123');
    expect(result.baseFormat.name).toBe('My Preset');
  });

  it('falls back to first format when key not found', () => {
    const result = computeEffectiveFormat('nonexistent', undefined, NO_CUSTOM, 1, []);
    expect(result.baseFormat.key).toBe(LABEL_FORMATS[0].key);
  });

  it('orientedBase reflects the orientation before customization', () => {
    const customState: CustomState = {
      customizing: true,
      overrides: { cellWidth: '10in' },
    };
    const result = computeEffectiveFormat('avery-5160', 'portrait', customState, 1, []);
    // orientedBase should have swapped dimensions (portrait)
    expect(result.orientedBase.cellWidth).toBe(avery5160.cellHeight);
    // But labelFormat should have the custom override
    expect(result.labelFormat.cellWidth).toBe('10in');
  });

  it('chain: base → orient → custom → scale → fontScale all apply', () => {
    const customState: CustomState = {
      customizing: true,
      overrides: { cellWidth: '5.266in', cellHeight: '2in' },
    };
    const result = computeEffectiveFormat('avery-5160', undefined, customState, 1.2, []);
    // Should have custom dimensions
    expect(result.labelFormat.cellWidth).toBe('5.266in');
    // Should have scaled + font-scaled name font
    const baseFontPt = parseFloat(avery5160.nameFontSize);
    const resultFontPt = parseFloat(result.labelFormat.nameFontSize);
    expect(resultFontPt).toBeGreaterThan(baseFontPt); // scaled up by both auto-scale and font-scale
  });
});
