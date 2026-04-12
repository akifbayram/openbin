import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import type { LocationUsageDay, UsageDay, UsageGranularity } from '@/types';
import { bucketByMonth, bucketByWeek, intensityStep, yearOf } from './usageBuckets';

type AnyUsageDay = UsageDay | LocationUsageDay;

interface UsageHeatmapProps {
  data: AnyUsageDay[];
  year: number;
  granularity: UsageGranularity;
  mode: 'per-bin' | 'aggregate';
  onDayClick?: (date: string) => void;
}

const OPACITY_BY_STEP = [0, 0.22, 0.48, 0.72];

function asCount(entry: AnyUsageDay, mode: 'per-bin' | 'aggregate'): number {
  if (mode === 'aggregate') return (entry as LocationUsageDay).binCount;
  return (entry as UsageDay).count;
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
}

function cellStyle(intensity: 0 | 1 | 2 | 3): React.CSSProperties {
  const opacity = OPACITY_BY_STEP[intensity];
  return {
    backgroundColor:
      intensity === 0
        ? 'var(--border-subtle)'
        : `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, transparent)`,
  };
}

function StaticCell({ intensity, tooltip }: { intensity: 0 | 1 | 2 | 3; tooltip?: string }) {
  const body = (
    <div
      data-testid="usage-cell"
      data-intensity={intensity}
      className="rounded-[var(--radius-xs)] transition-colors w-full h-full"
      style={cellStyle(intensity)}
    />
  );
  if (tooltip) return <Tooltip content={tooltip}>{body}</Tooltip>;
  return body;
}

function ButtonCell({
  intensity,
  tooltip,
  onClick,
}: {
  intensity: 0 | 1 | 2 | 3;
  tooltip: string | undefined;
  onClick: () => void;
}) {
  const body = (
    <button
      type="button"
      aria-label={tooltip}
      data-testid="usage-cell"
      data-intensity={intensity}
      onClick={onClick}
      className="rounded-[var(--radius-xs)] transition-colors w-full h-full cursor-pointer border-0 p-0"
      style={cellStyle(intensity)}
    />
  );
  if (tooltip) return <Tooltip content={tooltip}>{body}</Tooltip>;
  return body;
}

function Cell({
  intensity,
  tooltip,
  onClick,
}: {
  intensity: 0 | 1 | 2 | 3;
  tooltip?: string;
  onClick?: () => void;
}) {
  if (onClick) return <ButtonCell intensity={intensity} tooltip={tooltip} onClick={onClick} />;
  return <StaticCell intensity={intensity} tooltip={tooltip} />;
}

export function UsageHeatmap({ data, year, granularity, mode, onDayClick }: UsageHeatmapProps) {
  const normalized = useMemo(
    () => data.map((d) => ({ date: d.date, count: asCount(d, mode) })),
    [data, mode],
  );

  if (granularity === 'monthly') {
    const buckets = bucketByMonth(normalized, year);
    return (
      <div className="grid grid-cols-12 gap-1 w-full">
        {buckets.map((bucket) => {
          const step = intensityStep(bucket.activeDays, 'monthly');
          return (
            <div key={bucket.index} className="aspect-square">
              <Cell
                intensity={step}
                tooltip={`${bucket.label} ${year}: ${bucket.activeDays} active day${bucket.activeDays === 1 ? '' : 's'}`}
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (granularity === 'weekly') {
    const buckets = bucketByWeek(normalized, year);
    return (
      <div
        className="grid gap-1 w-full"
        style={{
          gridTemplateColumns: `repeat(${Math.ceil(buckets.length / 7)}, minmax(0, 1fr))`,
          gridAutoFlow: 'column',
          gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
        }}
      >
        {buckets.map((bucket) => {
          const step = intensityStep(bucket.activeDays, 'weekly');
          return (
            <div key={bucket.index} className="aspect-square">
              <Cell
                intensity={step}
                tooltip={`${bucket.label}: ${bucket.activeDays} active day${bucket.activeDays === 1 ? '' : 's'}`}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Daily: column-major 7-row grid (GitHub style)
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year, 11, 31);
  const totalDays = Math.round((yearEnd - yearStart) / 86_400_000) + 1;

  const byDate = new Map<string, number>();
  for (const n of normalized) if (yearOf(n.date) === year) byDate.set(n.date, n.count);

  const cells: { date: string; count: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const t = new Date(yearStart + i * 86_400_000);
    const iso = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
    cells.push({ date: iso, count: byDate.get(iso) ?? 0 });
  }

  return (
    <div
      className="grid gap-[3px] w-full"
      style={{
        gridTemplateColumns: `repeat(${Math.ceil(totalDays / 7)}, 1fr)`,
        gridAutoFlow: 'column',
        gridTemplateRows: 'repeat(7, 1fr)',
      }}
    >
      {cells.map((cell) => {
        const step = intensityStep(cell.count, 'daily');
        return (
          <div key={cell.date} className="aspect-square min-w-[8px]">
            <Cell
              intensity={step}
              tooltip={`${formatDate(cell.date)}: ${cell.count} hit${cell.count === 1 ? '' : 's'}`}
              onClick={onDayClick ? () => onDayClick(cell.date) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
