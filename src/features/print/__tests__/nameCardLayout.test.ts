import { describe, expect, it } from 'vitest';
import { computeContrastFg, computeNameFontSize } from '../nameCardLayout';

describe('computeContrastFg', () => {
  it('returns black for light backgrounds', () => {
    expect(computeContrastFg('#FFFFFF')).toBe('#000000');
    expect(computeContrastFg('#F2F2F7')).toBe('#000000');
    expect(computeContrastFg('#C8E6C9')).toBe('#000000');
  });

  it('returns white for dark backgrounds', () => {
    expect(computeContrastFg('#000000')).toBe('#FFFFFF');
    expect(computeContrastFg('#1C1C1E')).toBe('#FFFFFF');
    expect(computeContrastFg('#1B5E20')).toBe('#FFFFFF');
  });

  it('returns black for medium-light backgrounds', () => {
    expect(computeContrastFg('#BBDEFB')).toBe('#000000');
  });
});

describe('computeNameFontSize', () => {
  it('returns larger font for short names', () => {
    const short = computeNameFontSize({ cellWidthPt: 200, cellHeightPt: 72, paddingPt: 8, name: 'Tools', hasIcon: false });
    const long = computeNameFontSize({ cellWidthPt: 200, cellHeightPt: 72, paddingPt: 8, name: 'Holiday Decorations Outdoor', hasIcon: false });
    expect(short.fontSizePt).toBeGreaterThan(long.fontSizePt);
  });

  it('clamps to minimum 8pt', () => {
    const result = computeNameFontSize({ cellWidthPt: 50, cellHeightPt: 20, paddingPt: 4, name: 'A very long bin name that cannot possibly fit', hasIcon: false });
    expect(result.fontSizePt).toBe(8);
  });

  it('clamps to maximum 200pt', () => {
    const result = computeNameFontSize({ cellWidthPt: 2000, cellHeightPt: 2000, paddingPt: 8, name: 'X', hasIcon: false });
    expect(result.fontSizePt).toBe(200);
  });

  it('accounts for icon space when hasIcon is true', () => {
    const withIcon = computeNameFontSize({ cellWidthPt: 200, cellHeightPt: 72, paddingPt: 8, name: 'Tools', hasIcon: true });
    const noIcon = computeNameFontSize({ cellWidthPt: 200, cellHeightPt: 72, paddingPt: 8, name: 'Tools', hasIcon: false });
    expect(withIcon.fontSizePt).toBeLessThanOrEqual(noIcon.fontSizePt);
  });

  it('returns iconSizePt proportional to fontSizePt', () => {
    const result = computeNameFontSize({ cellWidthPt: 200, cellHeightPt: 72, paddingPt: 8, name: 'Tools', hasIcon: true });
    expect(result.iconSizePt).toBeCloseTo(result.fontSizePt * 0.9, 1);
  });

  it('handles empty name by using fallback length of 6', () => {
    const result = computeNameFontSize({ cellWidthPt: 200, cellHeightPt: 72, paddingPt: 8, name: '', hasIcon: false });
    expect(result.fontSizePt).toBeGreaterThan(8);
  });

  it('returns consistent results for uniform mode (min across bins)', () => {
    const names = ['Tools', 'Holiday Decorations Outdoor', 'Screws'];
    const sizes = names.map((name) =>
      computeNameFontSize({ cellWidthPt: 200, cellHeightPt: 72, paddingPt: 8, name, hasIcon: false }),
    );
    const uniformSize = Math.min(...sizes.map((s) => s.fontSizePt));
    expect(uniformSize).toBe(sizes[1].fontSizePt);
  });
});
