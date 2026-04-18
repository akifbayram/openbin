import { Flame } from 'lucide-react';
import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import {
  HEATMAP_OPACITY_BY_STEP,
  heatmapCellColor,
  type Intensity,
  intensityStep,
  toIsoUtc,
} from '@/features/usage/usageBuckets';
import { useLocationUsage } from '@/features/usage/useLocationUsage';
import { cn, flatCard, plural } from '@/lib/utils';
import type { LocationUsageDay } from '@/types';
import { SectionHeader } from './DashboardWidgets';

const DAYS = 30;
const GAP_PX = 3;

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const WEEKDAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });

const INTENSITY_STEPS: readonly Intensity[] = HEATMAP_OPACITY_BY_STEP.map((_, i) => i as Intensity);

interface DayCell {
  iso: string;
  count: number;
  intensity: Intensity;
  tooltip: string;
  isToday: boolean;
}

interface Last30Days {
  cells: DayCell[];
  activeDays: number;
  totalHits: number;
}

function buildLast30Days(usage: LocationUsageDay[]): Last30Days {
  const byDate = new Map<string, number>();
  for (const d of usage) {
    const n = typeof d.binCount === 'number' && Number.isFinite(d.binCount) ? Math.max(0, d.binCount) : 0;
    byDate.set(d.date, (byDate.get(d.date) ?? 0) + n);
  }

  const now = new Date();
  const todayMidnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const todayIso = toIsoUtc(new Date(todayMidnightUtc));

  const cells: DayCell[] = [];
  let activeDays = 0;
  let totalHits = 0;
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(todayMidnightUtc - i * 86_400_000);
    const iso = toIsoUtc(d);
    const count = byDate.get(iso) ?? 0;
    const isToday = iso === todayIso;
    const tooltip = `${WEEKDAY_FMT.format(d)}, ${DATE_FMT.format(d)} — ${count} ${plural(count, 'hit')}${isToday ? ' (today)' : ''}`;
    cells.push({ iso, count, intensity: intensityStep(count, 'daily'), tooltip, isToday });
    if (count > 0) activeDays++;
    totalHits += count;
  }
  return { cells, activeDays, totalHits };
}

interface DashboardMonthHeatmapProps {
  locationId: string;
}

export function DashboardMonthHeatmap({ locationId }: DashboardMonthHeatmapProps) {
  const { usage, isLoading, error } = useLocationUsage(locationId);

  const { cells, activeDays, totalHits } = useMemo(() => buildLast30Days(usage), [usage]);

  return (
    <section aria-labelledby="dash-month-heatmap" className="flex flex-col gap-2">
      <SectionHeader id="dash-month-heatmap" icon={Flame} title="Last 30 days" />
      <div className={cn(flatCard, 'p-4 flex flex-col gap-3')}>
        {isLoading && cells.length === 0 ? (
          <div className="h-[76px]" aria-hidden />
        ) : error ? (
          <p className="text-[12px] text-[var(--text-tertiary)]">Couldn't load activity</p>
        ) : (
          <>
            <div
              role="img"
              aria-label={`Activity for the last 30 days. ${activeDays} active ${plural(activeDays, 'day')}.`}
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))`,
                gap: GAP_PX,
              }}
            >
              {cells.map((cell) => (
                <Tooltip key={cell.iso} content={cell.tooltip} className="w-full">
                  <div
                    className={cn(
                      'w-full aspect-square rounded-full transition-colors duration-150 motion-reduce:transition-none',
                      cell.isToday && 'outline outline-1 outline-[var(--accent)] outline-offset-1',
                    )}
                    style={{ backgroundColor: heatmapCellColor(cell.intensity) }}
                    data-today={cell.isToday ? 'true' : undefined}
                  />
                </Tooltip>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-tertiary)]">
              <span className="tabular-nums">
                {activeDays} active {plural(activeDays, 'day')} · {totalHits} total
              </span>
              <div className="flex items-center gap-1">
                <span>Less</span>
                {INTENSITY_STEPS.map((step) => (
                  <span
                    key={step}
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: heatmapCellColor(step) }}
                  />
                ))}
                <span>More</span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
