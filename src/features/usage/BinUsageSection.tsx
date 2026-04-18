import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserPreferences } from '@/lib/userPreferences';
import { plural } from '@/lib/utils';
import { GranularitySegmented } from './GranularitySegmented';
import { InlineRetryError, UsageHeatmap, UsageHeatmapSkeleton } from './UsageHeatmap';
import { availableYears, yearOf } from './usageBuckets';
import { useBinUsage } from './useBinUsage';
import { YearChipPager } from './YearChipPager';

const RELATIVE_FMT = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function formatRelativeFromNow(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const days = Math.round((then - Date.now()) / 86_400_000);
  if (Math.abs(days) < 1) return RELATIVE_FMT.format(0, 'day');
  if (Math.abs(days) < 30) return RELATIVE_FMT.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return RELATIVE_FMT.format(months, 'month');
  return RELATIVE_FMT.format(Math.round(months / 12), 'year');
}

/** Server sorts DESC but don't trust it — malformed rows at the head would mask a valid latest date. */
function findLastValidDate(entries: Array<{ date: string }>): string | null {
  let latest: string | null = null;
  for (const e of entries) {
    if (!Number.isFinite(yearOf(e.date))) continue;
    if (latest === null || e.date > latest) latest = e.date;
  }
  return latest;
}

interface BinUsageSectionProps {
  binId: string;
}

export function BinUsageSection({ binId }: BinUsageSectionProps) {
  const { usage, isLoading, error, refresh } = useBinUsage(binId);
  const { preferences } = useUserPreferences();
  const years = useMemo(() => availableYears(usage), [usage]);
  const [year, setYear] = useState<number | null>(null);

  const selectedYear =
    year !== null && years.includes(year) ? year : (years[0] ?? new Date().getUTCFullYear());

  const lastUse = useMemo(() => findLastValidDate(usage), [usage]);
  const activeInYear = useMemo(() => {
    let count = 0;
    for (const d of usage) if (yearOf(d.date) === selectedYear) count++;
    return count;
  }, [usage, selectedYear]);

  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <UsageHeatmapSkeleton />
      ) : error ? (
        <InlineRetryError
          title="Couldn't load usage data"
          detail={error}
          onRetry={refresh}
          className="py-1"
        />
      ) : usage.length === 0 ? (
        <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed py-1">
          No activity yet. Choose which actions count in{' '}
          <Link to="/settings/preferences" className="underline text-[var(--accent)]">preferences</Link>.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <GranularitySegmented />
            <YearChipPager years={years} selected={selectedYear} onSelect={setYear} />
          </div>
          <UsageHeatmap
            data={usage}
            year={selectedYear}
            granularity={preferences.usage_granularity}
          />
          <p className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
            {activeInYear} active {plural(activeInYear, 'day')} in {selectedYear}
            {lastUse ? ` · last used ${formatRelativeFromNow(lastUse)}` : ''}
          </p>
        </>
      )}
    </div>
  );
}
