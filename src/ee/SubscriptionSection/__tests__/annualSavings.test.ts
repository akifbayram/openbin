import { describe, expect, it } from 'vitest';
import { computeAnnualSavings, formatPriceCents } from '../annualSavings';

describe('computeAnnualSavings', () => {
  it('returns 0 when annual is null (free plan)', () => {
    expect(computeAnnualSavings({ monthly: 0, annual: null })).toBe(0);
  });

  it('returns difference between 12*monthly and annual in cents', () => {
    expect(computeAnnualSavings({ monthly: 500, annual: 5000 })).toBe(1000);
  });

  it('returns 0 when annual is more expensive (no inverted savings)', () => {
    expect(computeAnnualSavings({ monthly: 100, annual: 5000 })).toBe(0);
  });
});

describe('formatPriceCents', () => {
  it('formats whole dollars with no decimals', () => {
    expect(formatPriceCents(500)).toBe('$5');
    expect(formatPriceCents(1000)).toBe('$10');
  });

  it('formats fractional dollars with two decimals', () => {
    expect(formatPriceCents(599)).toBe('$5.99');
  });

  it('handles zero', () => {
    expect(formatPriceCents(0)).toBe('$0');
  });
});
