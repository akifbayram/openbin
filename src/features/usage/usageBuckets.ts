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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a strict `YYYY-MM-DD` string. Returns null for any malformed input. */
export function parseIsoDate(iso: unknown): { y: number; m: number; d: number } | null {
  if (typeof iso !== 'string' || !ISO_DATE_RE.test(iso)) return null;
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** UTC year from an ISO date, or NaN for unparsable input. */
export function yearOf(isoDate: string): number {
  return parseIsoDate(isoDate)?.y ?? Number.NaN;
}

export function availableYears(data: { date: string }[]): number[] {
  const fallback = [new Date().getUTCFullYear()];
  if (data.length === 0) return fallback;
  const years = new Set<number>();
  for (const d of data) {
    const y = yearOf(d.date);
    if (Number.isFinite(y)) years.add(y);
  }
  if (years.size === 0) return fallback;
  return [...years].sort((a, b) => b - a);
}

const FALLBACK_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function bucketByMonth(
  data: { date: string; count: number }[],
  year: number,
): Bucket[] {
  const buckets: Bucket[] = FALLBACK_MONTH_LABELS.map((label, index) => ({
    index,
    activeDays: 0,
    totalCount: 0,
    label,
  }));

  if (!Number.isFinite(year)) return buckets;

  for (const day of data) {
    const parsed = parseIsoDate(day.date);
    if (!parsed || parsed.y !== year) continue;
    const monthIdx = parsed.m - 1;
    buckets[monthIdx].activeDays += 1;
    buckets[monthIdx].totalCount += Math.max(0, Number.isFinite(day.count) ? day.count : 0);
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

  if (!Number.isFinite(year)) return buckets;

  const yearStart = Date.UTC(year, 0, 1);

  for (const day of data) {
    const parsed = parseIsoDate(day.date);
    if (!parsed || parsed.y !== year) continue;
    const dayUtc = Date.UTC(parsed.y, parsed.m - 1, parsed.d);
    const dayOfYear = Math.floor((dayUtc - yearStart) / 86_400_000);
    if (dayOfYear < 0) continue;
    const weekIdx = Math.min(52, Math.floor(dayOfYear / 7));
    buckets[weekIdx].activeDays += 1;
    buckets[weekIdx].totalCount += Math.max(0, Number.isFinite(day.count) ? day.count : 0);
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
