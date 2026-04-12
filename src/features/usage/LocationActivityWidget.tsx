import { Activity, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionHeader } from '@/features/dashboard/DashboardWidgets';
import { useUserPreferences } from '@/lib/userPreferences';
import { cn, flatCard, plural } from '@/lib/utils';
import { GranularitySegmented } from './GranularitySegmented';
import { InlineRetryError, UsageHeatmap, UsageHeatmapSkeleton } from './UsageHeatmap';
import { availableYears, yearOf } from './usageBuckets';
import { useLocationUsage } from './useLocationUsage';
import { YearChipPager } from './YearChipPager';

interface LocationActivityWidgetProps {
  locationId: string;
}

export function LocationActivityWidget({ locationId }: LocationActivityWidgetProps) {
  const navigate = useNavigate();
  const { usage, isLoading, error, refresh } = useLocationUsage(locationId);
  const { preferences } = useUserPreferences();
  const years = useMemo(() => availableYears(usage), [usage]);
  const [year, setYear] = useState<number | null>(null);

  const selectedYear =
    year !== null && years.includes(year) ? year : (years[0] ?? new Date().getUTCFullYear());

  const { binDays, activeDays } = useMemo(() => {
    let bd = 0;
    let ad = 0;
    for (const d of usage) {
      if (yearOf(d.date) !== selectedYear) continue;
      const n = typeof d.binCount === 'number' && Number.isFinite(d.binCount) ? Math.max(0, d.binCount) : 0;
      bd += n;
      ad += 1;
    }
    return { binDays: bd, activeDays: ad };
  }, [usage, selectedYear]);

  const hasData = usage.length > 0;

  return (
    <section aria-labelledby="dash-activity" className="flex flex-col gap-2">
      <SectionHeader id="dash-activity" icon={Activity} title="Activity" />
      <div className={cn(flatCard, 'p-4 flex flex-col gap-3')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <GranularitySegmented />
          <YearChipPager years={years} selected={selectedYear} onSelect={setYear} />
        </div>
        {isLoading && !hasData ? (
          <UsageHeatmapSkeleton />
        ) : error && !hasData ? (
          <InlineRetryError
            title="Couldn't load activity"
            detail={error}
            onRetry={refresh}
            className="py-2"
          />
        ) : !hasData ? (
          <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed py-2">
            No activity recorded yet. Bins you scan, view, or modify will appear here.
          </p>
        ) : (
          <>
            <UsageHeatmap
              data={usage}
              year={selectedYear}
              granularity={preferences.usage_granularity}
              mode="aggregate"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
                {binDays} bin-{plural(binDays, 'day')} · {activeDays} active {plural(activeDays, 'day')} in {selectedYear}
              </p>
              <button
                type="button"
                onClick={() => navigate(`/bins?unused_since=${selectedYear}-01-01`)}
                className="inline-flex items-center gap-0.5 -mx-2 -my-1 px-2 py-1 text-[12px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors rounded-[var(--radius-xs)]"
              >
                View inactive bins
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
