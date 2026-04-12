import { Activity } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionHeader } from '@/features/dashboard/DashboardWidgets';
import { useUserPreferences } from '@/lib/userPreferences';
import { cn, disclosureSectionLabel } from '@/lib/utils';
import { GranularitySegmented } from './GranularitySegmented';
import { UsageHeatmap } from './UsageHeatmap';
import { availableYears, yearOf } from './usageBuckets';
import { useLocationUsage } from './useLocationUsage';
import { YearChipPager } from './YearChipPager';

interface LocationActivityWidgetProps {
  locationId: string;
}

export function LocationActivityWidget({ locationId }: LocationActivityWidgetProps) {
  const navigate = useNavigate();
  const { usage, isLoading } = useLocationUsage(locationId);
  const { preferences } = useUserPreferences();
  const years = useMemo(() => availableYears(usage), [usage]);
  const [year, setYear] = useState<number | null>(null);
  const selectedYear = year ?? years[0] ?? new Date().getUTCFullYear();

  const inYear = usage.filter((d) => yearOf(d.date) === selectedYear);
  const binDays = inYear.reduce((sum, d) => sum + d.binCount, 0);
  const activeDays = inYear.length;
  const hasData = usage.length > 0;

  return (
    <section aria-labelledby="dash-activity" className="flex flex-col gap-2">
      <SectionHeader id="dash-activity" icon={Activity} title="Activity" />
      <div className="rounded-[var(--radius-md)] bg-[var(--bg-flat)] border border-[var(--border-flat)] p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <GranularitySegmented />
          <YearChipPager years={years} selected={selectedYear} onSelect={setYear} />
        </div>
        {isLoading && !hasData ? (
          <p className="text-[12px] text-[var(--text-tertiary)] py-2">Loading…</p>
        ) : !hasData ? (
          <p className="text-[12px] text-[var(--text-tertiary)] py-2">
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
            <p className={cn(disclosureSectionLabel, 'text-[11px]')}>
              {binDays} bin-day{binDays === 1 ? '' : 's'} · {activeDays} active day{activeDays === 1 ? '' : 's'} in {selectedYear}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/bins?unused_since=${selectedYear}-01-01`)}
              className="text-[12px] text-[var(--accent)] self-start hover:underline"
            >
              Show bins unused since {selectedYear}-01-01
            </button>
          </>
        )}
      </div>
    </section>
  );
}
