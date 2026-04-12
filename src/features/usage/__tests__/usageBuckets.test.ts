import { describe, expect, it } from 'vitest';
import type { UsageDay } from '@/types';
import {
  availableYears,
  bucketByMonth,
  bucketByWeek,
  intensityStep,
  parseIsoDate,
  yearOf,
} from '../usageBuckets';

describe('availableYears', () => {
  it('returns unique years from usage data, descending', () => {
    const data: UsageDay[] = [
      { date: '2024-03-01', count: 1 },
      { date: '2025-06-15', count: 2 },
      { date: '2026-04-12', count: 1 },
      { date: '2025-07-01', count: 1 },
    ];
    expect(availableYears(data)).toEqual([2026, 2025, 2024]);
  });

  it('returns current year when data is empty', () => {
    expect(availableYears([])).toEqual([new Date().getUTCFullYear()]);
  });
});

describe('bucketByMonth', () => {
  it('produces 12 buckets indexed 0–11 (Jan–Dec)', () => {
    const data: UsageDay[] = [
      { date: '2026-01-05', count: 1 },
      { date: '2026-01-06', count: 2 },
      { date: '2026-03-10', count: 1 },
    ];
    const buckets = bucketByMonth(data, 2026);
    expect(buckets).toHaveLength(12);
    expect(buckets[0].activeDays).toBe(2);
    expect(buckets[0].totalCount).toBe(3);
    expect(buckets[2].activeDays).toBe(1);
    expect(buckets[1].activeDays).toBe(0);
  });

  it('ignores dates outside the requested year', () => {
    const data: UsageDay[] = [
      { date: '2025-12-31', count: 5 },
      { date: '2026-01-01', count: 1 },
    ];
    const buckets = bucketByMonth(data, 2026);
    expect(buckets[0].activeDays).toBe(1);
    expect(buckets.reduce((s, b) => s + b.activeDays, 0)).toBe(1);
  });
});

describe('bucketByWeek', () => {
  it('produces exactly 53 weekly buckets for a year', () => {
    const buckets = bucketByWeek([], 2026);
    expect(buckets).toHaveLength(53);
  });

  it('groups days into week-of-year buckets', () => {
    const data: UsageDay[] = [
      { date: '2026-01-01', count: 1 },
      { date: '2026-01-05', count: 1 },
      { date: '2026-01-08', count: 1 },
    ];
    const buckets = bucketByWeek(data, 2026);
    expect(buckets[0].activeDays + buckets[1].activeDays).toBe(3);
  });
});

describe('intensityStep', () => {
  it('daily: 0/1/2-3/4+', () => {
    expect(intensityStep(0, 'daily')).toBe(0);
    expect(intensityStep(1, 'daily')).toBe(1);
    expect(intensityStep(2, 'daily')).toBe(2);
    expect(intensityStep(3, 'daily')).toBe(2);
    expect(intensityStep(4, 'daily')).toBe(3);
    expect(intensityStep(99, 'daily')).toBe(3);
  });

  it('weekly: 0/1-2/3-4/5+', () => {
    expect(intensityStep(0, 'weekly')).toBe(0);
    expect(intensityStep(1, 'weekly')).toBe(1);
    expect(intensityStep(2, 'weekly')).toBe(1);
    expect(intensityStep(3, 'weekly')).toBe(2);
    expect(intensityStep(4, 'weekly')).toBe(2);
    expect(intensityStep(5, 'weekly')).toBe(3);
    expect(intensityStep(7, 'weekly')).toBe(3);
  });

  it('monthly: 0/1-5/6-10/11+', () => {
    expect(intensityStep(0, 'monthly')).toBe(0);
    expect(intensityStep(1, 'monthly')).toBe(1);
    expect(intensityStep(5, 'monthly')).toBe(1);
    expect(intensityStep(6, 'monthly')).toBe(2);
    expect(intensityStep(10, 'monthly')).toBe(2);
    expect(intensityStep(11, 'monthly')).toBe(3);
    expect(intensityStep(31, 'monthly')).toBe(3);
  });
});

describe('yearOf', () => {
  it('extracts UTC year from ISO date', () => {
    expect(yearOf('2026-04-12')).toBe(2026);
    expect(yearOf('1999-12-31')).toBe(1999);
  });

  it('returns NaN for malformed input', () => {
    expect(Number.isNaN(yearOf(''))).toBe(true);
    expect(Number.isNaN(yearOf('garbage'))).toBe(true);
    expect(Number.isNaN(yearOf('2026-13-01'))).toBe(true);
    expect(Number.isNaN(yearOf('2026-01-32'))).toBe(true);
    expect(Number.isNaN(yearOf('26-01-01'))).toBe(true);
  });
});

describe('parseIsoDate', () => {
  it('parses well-formed dates', () => {
    expect(parseIsoDate('2026-04-12')).toEqual({ y: 2026, m: 4, d: 12 });
  });

  it('rejects malformed input', () => {
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('garbage')).toBeNull();
    expect(parseIsoDate('2026-00-01')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('2026-01-32')).toBeNull();
    expect(parseIsoDate(null as unknown as string)).toBeNull();
    expect(parseIsoDate(undefined as unknown as string)).toBeNull();
  });
});

describe('availableYears with malformed data', () => {
  it('skips invalid dates and returns valid years', () => {
    const data: UsageDay[] = [
      { date: '2026-04-12', count: 1 },
      { date: 'garbage', count: 1 },
      { date: '2025-01-01', count: 1 },
    ];
    expect(availableYears(data)).toEqual([2026, 2025]);
  });

  it('returns current-year fallback when all dates are invalid', () => {
    const data: UsageDay[] = [
      { date: '', count: 1 },
      { date: 'nope', count: 1 },
    ];
    expect(availableYears(data)).toEqual([new Date().getUTCFullYear()]);
  });
});

describe('bucketByMonth with malformed data', () => {
  it('skips invalid dates without throwing', () => {
    const data: UsageDay[] = [
      { date: '2026-01-05', count: 2 },
      { date: 'garbage', count: 99 },
      { date: '2026-01-06', count: Number.NaN },
    ];
    const buckets = bucketByMonth(data, 2026);
    expect(buckets[0].activeDays).toBe(2);
    expect(buckets[0].totalCount).toBe(2);
  });

  it('returns empty buckets when year is NaN', () => {
    const buckets = bucketByMonth([{ date: '2026-01-05', count: 1 }], Number.NaN);
    expect(buckets.every((b) => b.activeDays === 0)).toBe(true);
  });

  it('clamps negative counts to 0', () => {
    const buckets = bucketByMonth([{ date: '2026-01-05', count: -10 }], 2026);
    expect(buckets[0].totalCount).toBe(0);
  });
});
