import { describe, it, expect } from 'vitest';
import { computeScaleFactor, scaleValue, applyAutoScale, applyFontScale } from '../labelScaling';
import type { LabelFormat } from '../labelFormats';

function makeFormat(overrides: Partial<LabelFormat> = {}): LabelFormat {
  return {
    key: 'test',
    name: 'Test',
    columns: 3,
    cellWidth: '2in',
    cellHeight: '1in',
    qrSize: '0.75in',
    padding: '2pt 4pt',
    nameFontSize: '8pt',
    contentFontSize: '6pt',
    codeFontSize: '14pt',
    pageMarginTop: '0.5in',
    pageMarginBottom: '0.5in',
    pageMarginLeft: '0.3in',
    pageMarginRight: '0.3in',
    ...overrides,
  };
}

describe('computeScaleFactor', () => {
  it('returns 1 when dimensions match', () => {
    const fmt = makeFormat();
    expect(computeScaleFactor(fmt, fmt)).toBe(1);
  });

  it('returns correct factor for doubled width', () => {
    const base = makeFormat({ cellWidth: '2in', cellHeight: '1in' });
    const custom = makeFormat({ cellWidth: '4in', cellHeight: '2in' });
    expect(computeScaleFactor(base, custom)).toBe(2);
  });

  it('uses the smaller dimension ratio', () => {
    const base = makeFormat({ cellWidth: '2in', cellHeight: '1in' });
    const custom = makeFormat({ cellWidth: '3in', cellHeight: '1in' });
    // width ratio = 1.5, height ratio = 1, min = 1
    expect(computeScaleFactor(base, custom)).toBe(1);
  });

  it('returns 1 for zero-sized base', () => {
    const base = makeFormat({ cellWidth: '0in', cellHeight: '0in' });
    const custom = makeFormat();
    expect(computeScaleFactor(base, custom)).toBe(1);
  });
});

describe('scaleValue', () => {
  it('scales single value with unit', () => {
    expect(scaleValue('8pt', 2)).toBe('16pt');
  });

  it('scales multiple space-separated values', () => {
    expect(scaleValue('2pt 4pt', 2)).toBe('4pt 8pt');
  });

  it('handles factor of 1', () => {
    expect(scaleValue('8pt', 1)).toBe('8pt');
  });

  it('trims trailing zeros', () => {
    expect(scaleValue('3pt', 2)).toBe('6pt');
  });

  it('handles fractional results', () => {
    const result = scaleValue('10pt', 0.75);
    expect(result).toBe('7.5pt');
  });
});

describe('applyAutoScale', () => {
  it('returns custom unchanged when scale factor is 1', () => {
    const base = makeFormat();
    const custom = makeFormat();
    expect(applyAutoScale(base, custom)).toBe(custom);
  });

  it('scales font sizes and padding when dimensions differ', () => {
    const base = makeFormat({ cellWidth: '2in', cellHeight: '1in', nameFontSize: '8pt' });
    const custom = makeFormat({ cellWidth: '4in', cellHeight: '2in' });
    const result = applyAutoScale(base, custom);
    // Scale factor = 2, so 8pt -> 16pt
    expect(result.nameFontSize).toBe('16pt');
  });
});

describe('applyFontScale', () => {
  it('returns format unchanged when scale is 1', () => {
    const fmt = makeFormat();
    expect(applyFontScale(fmt, 1)).toBe(fmt);
  });

  it('scales name, content, and code font sizes', () => {
    const fmt = makeFormat({ nameFontSize: '10pt', contentFontSize: '8pt', codeFontSize: '14pt' });
    const result = applyFontScale(fmt, 1.5);
    expect(result.nameFontSize).toBe('15pt');
    expect(result.contentFontSize).toBe('12pt');
    expect(result.codeFontSize).toBe('21pt');
  });

  it('does not modify non-font properties', () => {
    const fmt = makeFormat();
    const result = applyFontScale(fmt, 1.5);
    expect(result.cellWidth).toBe(fmt.cellWidth);
    expect(result.padding).toBe(fmt.padding);
    expect(result.qrSize).toBe(fmt.qrSize);
  });
});
