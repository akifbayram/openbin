import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { useUserPreferences } from '@/lib/userPreferences';
import { cn, disclosureSectionLabel } from '@/lib/utils';
import { GranularitySegmented } from './GranularitySegmented';
import { UsageHeatmap } from './UsageHeatmap';
import { availableYears, yearOf } from './usageBuckets';
import { useBinUsage } from './useBinUsage';
import { YearChipPager } from './YearChipPager';

function formatDaysAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

interface BinUsageSectionProps {
  binId: string;
}

export function BinUsageSection({ binId }: BinUsageSectionProps) {
  const { usage, isLoading } = useBinUsage(binId);
  const { preferences } = useUserPreferences();
  const years = useMemo(() => availableYears(usage), [usage]);
  const [year, setYear] = useState<number | null>(null);
  const selectedYear = year ?? years[0] ?? new Date().getUTCFullYear();

  const activeInYear = usage.filter((d) => yearOf(d.date) === selectedYear).length;
  const lastUse = usage[0]?.date;

  return (
    <Card>
      <CardContent className="!py-0">
        <Disclosure label="Usage" labelClassName={disclosureSectionLabel}>
          <div className="pb-3 flex flex-col gap-3">
            {isLoading ? (
              <div className="text-[13px] text-[var(--text-tertiary)]">Loading…</div>
            ) : usage.length === 0 ? (
              <div className="text-[13px] text-[var(--text-tertiary)]">
                No activity recorded yet. Update triggers in{' '}
                <Link to="/settings/preferences" className="underline text-[var(--accent)]">preferences</Link>.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <GranularitySegmented />
                  <YearChipPager
                    years={years}
                    selected={selectedYear}
                    onSelect={setYear}
                  />
                </div>
                <UsageHeatmap
                  data={usage}
                  year={selectedYear}
                  granularity={preferences.usage_granularity}
                  mode="per-bin"
                />
                <p className={cn(disclosureSectionLabel, 'text-[11px] text-[var(--text-tertiary)]')}>
                  {activeInYear} active day{activeInYear === 1 ? '' : 's'} in {selectedYear}
                  {lastUse ? ` · last use ${formatDaysAgo(lastUse)}` : ''}
                </p>
              </>
            )}
          </div>
        </Disclosure>
      </CardContent>
    </Card>
  );
}
