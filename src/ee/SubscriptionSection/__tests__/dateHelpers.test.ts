import { describe, expect, it } from 'vitest';
import { daysUntil, formatBillingDate } from '../dateHelpers';

describe('formatBillingDate', () => {
  it('formats ISO timestamp as "Month D, YYYY" in UTC', () => {
    expect(formatBillingDate('2026-05-27T00:00:00Z')).toBe('May 27, 2026');
  });

  it('keeps the same calendar day across timezones (UTC anchor)', () => {
    expect(formatBillingDate('2026-01-01T00:00:00Z')).toBe('January 1, 2026');
  });
});

describe('daysUntil', () => {
  it('returns null for null input', () => {
    expect(daysUntil(null)).toBeNull();
  });

  it('returns 0 for past dates', () => {
    expect(daysUntil('2020-01-01T00:00:00Z')).toBe(0);
  });

  it('returns positive ceil days for future dates', () => {
    const future = new Date(Date.now() + 5 * 24 * 3600 * 1000 + 1000).toISOString();
    expect(daysUntil(future)).toBe(6); // ceil of just over 5
  });
});
