import type { UsageGranularity } from '@/types';

export interface Bucket {
  /** 0-indexed position within the year */
  index: number;
  /** Count of distinct UTC dates with any activity inside this bucket */
  activeDays: number;
  /** Sum of all `count` values inside this bucket */
  totalCount: number;
  /** Human-readable label (e.g. 'Jan', 'Feb' for monthly) */
  label: string;
}

export function yearOf(isoDate: string): number {
  return parseInt(isoDate.slice(0, 4), 10);
}

export function availableYears(data: { date: string }[]): number[] {
  if (data.length === 0) return [new Date().getUTCFullYear()];
  const years = new Set<number>();
  for (const d of data) years.add(yearOf(d.date));
  return [...years].sort((a, b) => b - a);
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function bucketByMonth(
  data: { date: string; count: number }[],
  year: number,
): Bucket[] {
  const buckets: Bucket[] = MONTH_LABELS.map((label, index) => ({
    index,
    activeDays: 0,
    totalCount: 0,
    label,
  }));

  for (const day of data) {
    if (yearOf(day.date) !== year) continue;
    const month = parseInt(day.date.slice(5, 7), 10) - 1;
    if (month < 0 || month > 11) continue;
    buckets[month].activeDays += 1;
    buckets[month].totalCount += day.count;
  }

  return buckets;
}

/**
 * Week-of-year bucketing: day-of-year divided by 7. Always 53 buckets
 * (covers both 52- and 53-week years).
 */
export function bucketByWeek(
  data: { date: string; count: number }[],
  year: number,
): Bucket[] {
  const buckets: Bucket[] = Array.from({ length: 53 }, (_, index) => ({
    index,
    activeDays: 0,
    totalCount: 0,
    label: `W${index + 1}`,
  }));

  const yearStart = Date.UTC(year, 0, 1);

  for (const day of data) {
    if (yearOf(day.date) !== year) continue;
    const parts = day.date.split('-').map(Number);
    const dayUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    const dayOfYear = Math.floor((dayUtc - yearStart) / 86_400_000);
    if (dayOfYear < 0) continue;
    const weekIdx = Math.min(52, Math.floor(dayOfYear / 7));
    buckets[weekIdx].activeDays += 1;
    buckets[weekIdx].totalCount += day.count;
  }

  return buckets;
}

/**
 * Map a bucket's `activeDays` (weekly/monthly) or daily `count` to an intensity
 * step 0..3. 0 = empty.
 */
export function intensityStep(value: number, granularity: UsageGranularity): 0 | 1 | 2 | 3 {
  if (value <= 0) return 0;
  if (granularity === 'daily') {
    if (value === 1) return 1;
    if (value <= 3) return 2;
    return 3;
  }
  if (granularity === 'weekly') {
    if (value <= 2) return 1;
    if (value <= 4) return 2;
    return 3;
  }
  // monthly
  if (value <= 5) return 1;
  if (value <= 10) return 2;
  return 3;
}
