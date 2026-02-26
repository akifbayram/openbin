import { describe, it, expect } from 'vitest';
import { toInches, toPoints, inchesToMm, mmToInches, parsePaddingPt } from '../pdfUnits';

describe('toInches', () => {
  it('parses inches (bare number)', () => {
    expect(toInches('2.5')).toBe(2.5);
  });

  it('parses inches with "in" suffix', () => {
    expect(toInches('2.625in')).toBe(2.625);
  });

  it('converts millimeters to inches', () => {
    expect(toInches('25.4mm')).toBeCloseTo(1, 6);
  });

  it('converts points to inches', () => {
    expect(toInches('72pt')).toBeCloseTo(1, 6);
    expect(toInches('36pt')).toBeCloseTo(0.5, 6);
  });
});

describe('toPoints', () => {
  it('converts inches to points (72pt = 1in)', () => {
    expect(toPoints('1in')).toBeCloseTo(72, 6);
    expect(toPoints('0.5')).toBeCloseTo(36, 6);
  });

  it('converts pt values', () => {
    expect(toPoints('8pt')).toBeCloseTo(8, 6);
  });

  it('converts mm to points', () => {
    expect(toPoints('25.4mm')).toBeCloseTo(72, 6);
  });
});

describe('inchesToMm', () => {
  it('converts 1 inch to 25.4mm', () => {
    expect(inchesToMm(1)).toBe(25.4);
  });

  it('converts 0 inches to 0mm', () => {
    expect(inchesToMm(0)).toBe(0);
  });

  it('rounds to 1 decimal place', () => {
    expect(inchesToMm(2.625)).toBe(66.7);
  });
});

describe('mmToInches', () => {
  it('converts 25.4mm to 1 inch', () => {
    expect(mmToInches(25.4)).toBeCloseTo(1, 6);
  });

  it('converts 0mm to 0 inches', () => {
    expect(mmToInches(0)).toBe(0);
  });

  it('roundtrip stays within tolerance', () => {
    const original = 2.625;
    const roundtripped = mmToInches(inchesToMm(original));
    expect(Math.abs(roundtripped - original)).toBeLessThan(0.01);
  });
});

describe('parsePaddingPt', () => {
  it('parses single value (all sides)', () => {
    const result = parsePaddingPt('8pt');
    expect(result).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });

  it('parses two values (vertical horizontal)', () => {
    const result = parsePaddingPt('6pt 12pt');
    expect(result).toEqual({ top: 6, right: 12, bottom: 6, left: 12 });
  });

  it('parses three values (top horizontal bottom)', () => {
    const result = parsePaddingPt('4pt 8pt 6pt');
    expect(result).toEqual({ top: 4, right: 8, bottom: 6, left: 8 });
  });

  it('parses four values (top right bottom left)', () => {
    const result = parsePaddingPt('2pt 4pt 6pt 8pt');
    expect(result).toEqual({ top: 2, right: 4, bottom: 6, left: 8 });
  });

  it('handles inch values', () => {
    const result = parsePaddingPt('1in');
    expect(result.top).toBeCloseTo(72, 6);
    expect(result.right).toBeCloseTo(72, 6);
  });

  it('handles mixed units', () => {
    const result = parsePaddingPt('1in 36pt');
    expect(result.top).toBeCloseTo(72, 6);
    expect(result.right).toBeCloseTo(36, 6);
  });
});
