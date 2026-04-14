import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, haptic, plural } from '@/lib/utils';
import type { LocationUsageDay, UsageDay, UsageGranularity } from '@/types';
import { bucketByMonth, bucketByWeek, intensityStep, parseIsoDate, yearOf } from './usageBuckets';

type AnyUsageDay = UsageDay | LocationUsageDay;
type Intensity = 0 | 1 | 2 | 3;

interface UsageHeatmapProps {
  data: AnyUsageDay[];
  year: number;
  granularity: UsageGranularity;
  mode: 'per-bin' | 'aggregate';
  onDayClick?: (date: string) => void;
}

const CELL_SIZE = 10;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const OPACITY_BY_STEP = [0, 0.22, 0.48, 0.82];
// Full weekday list is kept for a11y; display filters to Mon/Wed/Fri to reduce clutter.
const VISIBLE_DOW = new Set([1, 3, 5]);

const CELL_TRANSITION =
  'transition-[background-color,outline-color] duration-150 ease-out motion-reduce:transition-none';

function todayUtcIso(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function asCount(entry: AnyUsageDay, mode: 'per-bin' | 'aggregate'): number {
  const raw = mode === 'aggregate' ? (entry as LocationUsageDay).binCount : (entry as UsageDay).count;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return 0;
  return raw;
}

// All formatters pin timeZone: 'UTC' because the Date inputs are UTC-constructed
// (Date.UTC / ISO YYYY-MM-DD). Without this, locales west of UTC render midnight-UTC
// as the prior local day — shifting month labels and tooltips by one (e.g. Jan → "Dec").
const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const MONTH_SHORT_FMT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  timeZone: 'UTC',
});
const WEEKDAY_SHORT_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  timeZone: 'UTC',
});

const MONTH_LABELS: string[] = Array.from({ length: 12 }, (_, i) =>
  MONTH_SHORT_FMT.format(new Date(Date.UTC(2024, i, 1))),
);

// 2024-01-07 is a Sunday in UTC; used to anchor the 7 weekday labels.
const DOW_LABELS: string[] = Array.from({ length: 7 }, (_, i) =>
  WEEKDAY_SHORT_FMT.format(new Date(Date.UTC(2024, 0, 7 + i))),
);

function formatPrettyDate(isoDate: string): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  return DATE_FMT.format(new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)));
}

function cellColor(intensity: Intensity): string {
  if (intensity === 0) return 'var(--border-subtle)';
  const pct = Math.round(OPACITY_BY_STEP[intensity] * 100);
  return `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;
}

function cellBoxStyle(intensity: Intensity, fill?: boolean): React.CSSProperties {
  const base: React.CSSProperties = { backgroundColor: cellColor(intensity) };
  if (!fill) {
    base.width = CELL_SIZE;
    base.height = CELL_SIZE;
  }
  return base;
}

function cellClassName(interactive: boolean, fill?: boolean, highlight?: boolean): string {
  return cn(
    'rounded-full',
    CELL_TRANSITION,
    interactive && [
      'cursor-pointer border-0 p-0',
      'hover:outline hover:outline-1 hover:outline-[var(--accent)]',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1',
    ],
    fill && 'w-full aspect-square',
    highlight && 'outline outline-1 outline-[var(--accent)] outline-offset-1',
  );
}

function Cell({
  intensity,
  tooltip,
  onClick,
  fill,
  highlight,
}: {
  intensity: Intensity;
  tooltip?: string;
  onClick?: () => void;
  fill?: boolean;
  highlight?: boolean;
}) {
  const todayAttr = highlight ? 'true' : undefined;
  const style = cellBoxStyle(intensity, fill);
  const body = onClick ? (
    <button
      type="button"
      aria-label={tooltip}
      data-testid="usage-cell"
      data-intensity={intensity}
      data-today={todayAttr}
      onClick={() => {
        haptic(8);
        onClick();
      }}
      className={cellClassName(true, fill, highlight)}
      style={style}
    />
  ) : (
    <div
      data-testid="usage-cell"
      data-intensity={intensity}
      data-today={todayAttr}
      className={cellClassName(false, fill, highlight)}
      style={style}
    />
  );
  if (!tooltip) return body;
  return (
    <Tooltip content={tooltip} className={fill ? 'w-full' : undefined}>
      {body}
    </Tooltip>
  );
}

function MonthLabelTrack({
  positions,
  width,
}: {
  positions: Array<{ month: string; col: number }>;
  width: number;
}) {
  return (
    <div className="relative h-3" style={{ width }}>
      {positions.map((m) => (
        <span
          key={`${m.month}-${m.col}`}
          style={{ left: m.col * CELL_STEP }}
          className="absolute top-0 text-[11px] text-[var(--text-tertiary)] leading-none"
        >
          {m.month}
        </span>
      ))}
    </div>
  );
}

interface DailyCell {
  key: string;
  date: string | null;
  count: number;
}

interface DailyGrid {
  cells: DailyCell[];
  weeks: number;
  monthPositions: Array<{ month: string; col: number }>;
  activeDays: number;
}

function buildDailyGrid(
  data: Array<{ date: string; count: number }>,
  year: number,
): DailyGrid {
  if (!Number.isFinite(year)) return { cells: [], weeks: 0, monthPositions: [], activeDays: 0 };

  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year, 11, 31);
  const totalDays = Math.round((yearEnd - yearStart) / 86_400_000) + 1;
  const firstDow = new Date(yearStart).getUTCDay();

  const byDate = new Map<string, number>();
  for (const d of data) {
    if (yearOf(d.date) !== year) continue;
    const n = typeof d.count === 'number' && Number.isFinite(d.count) ? Math.max(0, d.count) : 0;
    // Sum duplicates defensively — server shouldn't emit them, but collapse if it does.
    byDate.set(d.date, (byDate.get(d.date) ?? 0) + n);
  }
  let activeDays = 0;
  for (const v of byDate.values()) if (v > 0) activeDays++;

  const cells: DailyCell[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ key: `pad-lead-${year}-${i}`, date: null, count: 0 });
  }
  for (let i = 0; i < totalDays; i++) {
    const t = new Date(yearStart + i * 86_400_000);
    const iso = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
    cells.push({ key: iso, date: iso, count: byDate.get(iso) ?? 0 });
  }
  const weeks = Math.ceil(cells.length / 7);
  let tailIdx = 0;
  while (cells.length < weeks * 7) {
    cells.push({ key: `pad-tail-${year}-${tailIdx++}`, date: null, count: 0 });
  }

  const monthPositions: Array<{ month: string; col: number }> = [];
  let lastMonth = -1;
  cells.forEach((cell, idx) => {
    if (!cell.date) return;
    const parsed = parseIsoDate(cell.date);
    if (!parsed) return;
    const monthIdx = parsed.m - 1;
    if (monthIdx !== lastMonth) {
      monthPositions.push({ month: MONTH_LABELS[monthIdx], col: Math.floor(idx / 7) });
      lastMonth = monthIdx;
    }
  });

  return { cells, weeks, monthPositions, activeDays };
}

function buildWeeklyMonthPositions(
  year: number,
  weekCount: number,
): Array<{ month: string; col: number }> {
  if (!Number.isFinite(year)) return [];
  const yearStart = Date.UTC(year, 0, 1);
  const positions: Array<{ month: string; col: number }> = [];
  let lastMonth = -1;
  for (let w = 0; w < weekCount; w++) {
    const weekStart = new Date(yearStart + w * 7 * 86_400_000);
    if (weekStart.getUTCFullYear() !== year) continue;
    const month = weekStart.getUTCMonth();
    if (month !== lastMonth) {
      positions.push({ month: MONTH_LABELS[month], col: w });
      lastMonth = month;
    }
  }
  return positions;
}

function DailyView({
  data,
  year,
  onDayClick,
}: {
  data: Array<{ date: string; count: number }>;
  year: number;
  onDayClick?: (date: string) => void;
}) {
  const { cells, weeks, monthPositions, activeDays } = useMemo(
    () => buildDailyGrid(data, year),
    [data, year],
  );
  const gridWidth = weeks * CELL_SIZE + (weeks - 1) * CELL_GAP;
  const todayIso = todayUtcIso();

  return (
    <div
      key={year}
      className="flex flex-col gap-2 animate-fade-in motion-reduce:animate-none"
      role="img"
      aria-label={`Daily usage heatmap for ${year}. ${activeDays} active ${plural(activeDays, 'day')}.`}
    >
      <div className="overflow-x-auto scrollbar-thin -mx-1 px-1 pb-0.5" style={{ overscrollBehaviorX: 'contain' }}>
        <div className="inline-flex gap-2 items-start">
          <div
            className="flex flex-col shrink-0"
            style={{ rowGap: CELL_GAP, paddingTop: 16 }}
            aria-hidden
          >
            {DOW_LABELS.map((label, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-slot week, locales may repeat short labels
                key={i}
                style={{ height: CELL_SIZE, lineHeight: `${CELL_SIZE}px` }}
                className="text-[11px] text-[var(--text-tertiary)] pr-1 text-right"
              >
                {VISIBLE_DOW.has(i) ? label : '\u00A0'}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <MonthLabelTrack positions={monthPositions} width={gridWidth} />
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${weeks}, ${CELL_SIZE}px)`,
                gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                gridAutoFlow: 'column',
                gap: CELL_GAP,
              }}
            >
              {cells.map((cell) => {
                if (!cell.date) return <div key={cell.key} aria-hidden />;
                const intensity = intensityStep(cell.count, 'daily');
                const date = cell.date;
                const isToday = date === todayIso;
                const tooltipBase = `${formatPrettyDate(date)} — ${cell.count} ${plural(cell.count, 'hit')}`;
                return (
                  <Cell
                    key={cell.key}
                    intensity={intensity}
                    highlight={isToday}
                    tooltip={isToday ? `${tooltipBase} (today)` : tooltipBase}
                    onClick={onDayClick ? () => onDayClick(date) : undefined}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeeklyView({
  data,
  year,
}: {
  data: Array<{ date: string; count: number }>;
  year: number;
}) {
  const buckets = useMemo(() => bucketByWeek(data, year), [data, year]);
  const monthPositions = useMemo(
    () => buildWeeklyMonthPositions(year, buckets.length),
    [year, buckets.length],
  );
  const gridWidth = buckets.length * CELL_SIZE + (buckets.length - 1) * CELL_GAP;
  const activeWeeks = useMemo(
    () => buckets.reduce((s, b) => s + (b.activeDays > 0 ? 1 : 0), 0),
    [buckets],
  );

  return (
    <div
      key={year}
      className="flex flex-col gap-2 animate-fade-in motion-reduce:animate-none"
      role="img"
      aria-label={`Weekly usage heatmap for ${year}. ${activeWeeks} active ${plural(activeWeeks, 'week')}.`}
    >
      <div className="overflow-x-auto scrollbar-thin -mx-1 px-1 pb-0.5" style={{ overscrollBehaviorX: 'contain' }}>
        <div className="inline-flex flex-col gap-1">
          <MonthLabelTrack positions={monthPositions} width={gridWidth} />
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${buckets.length}, ${CELL_SIZE}px)`,
              gridAutoRows: `${CELL_SIZE}px`,
              gap: CELL_GAP,
            }}
          >
            {buckets.map((bucket) => {
              const intensity = intensityStep(bucket.activeDays, 'weekly');
              return (
                <Cell
                  key={bucket.index}
                  intensity={intensity}
                  tooltip={`Week ${bucket.index + 1}, ${year} — ${bucket.activeDays} active ${plural(bucket.activeDays, 'day')}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthlyView({
  data,
  year,
}: {
  data: Array<{ date: string; count: number }>;
  year: number;
}) {
  const buckets = useMemo(() => bucketByMonth(data, year), [data, year]);
  const activeMonths = useMemo(
    () => buckets.reduce((s, b) => s + (b.activeDays > 0 ? 1 : 0), 0),
    [buckets],
  );

  return (
    <div
      key={year}
      className="flex flex-col gap-2 animate-fade-in motion-reduce:animate-none"
      role="img"
      aria-label={`Monthly usage heatmap for ${year}. ${activeMonths} active ${plural(activeMonths, 'month')}.`}
    >
      <div className="grid grid-cols-12 gap-[6px]">
        {buckets.map((bucket) => {
          const intensity = intensityStep(bucket.activeDays, 'monthly');
          const label = MONTH_LABELS[bucket.index] ?? bucket.label;
          return (
            <div key={bucket.index} className="flex flex-col items-center gap-1 min-w-0">
              <Cell
                intensity={intensity}
                fill
                tooltip={`${label} ${year} — ${bucket.activeDays} active ${plural(bucket.activeDays, 'day')}`}
              />
              <span className="text-[11px] text-[var(--text-tertiary)] leading-none">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Loading skeleton that mirrors the heatmap footprint to avoid layout shift. */
export function UsageHeatmapSkeleton() {
  const weeks = 53;
  const gridWidth = weeks * CELL_SIZE + (weeks - 1) * CELL_GAP;
  return (
    <div className="flex flex-col gap-2" aria-hidden aria-busy="true">
      <div className="overflow-x-hidden -mx-1 px-1 pb-0.5">
        <div className="inline-flex gap-2 items-start">
          <div style={{ width: 24, paddingTop: 16 }} />
          <div className="flex flex-col gap-1">
            <div className="h-3" style={{ width: gridWidth }} />
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${weeks}, ${CELL_SIZE}px)`,
                gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                gridAutoFlow: 'column',
                gap: CELL_GAP,
              }}
            >
              {Array.from({ length: weeks * 7 }).map((_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton, never reordered
                  key={i}
                  className="rounded-full animate-pulse motion-reduce:animate-none"
                  style={{ backgroundColor: 'var(--border-subtle)', width: CELL_SIZE, height: CELL_SIZE }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Error state with a retry affordance — shared by bin and location usage views. */
export function InlineRetryError({
  title,
  detail,
  onRetry,
  className,
}: {
  title: string;
  detail?: string | null;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} role="alert">
      <p className="text-[13px] font-medium text-[var(--text-primary)] leading-snug">{title}</p>
      {detail ? (
        <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">{detail}</p>
      ) : null}
      <button
        type="button"
        onClick={onRetry}
        className="self-start -mx-2 -my-1 px-2 py-1 text-[13px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] rounded-[var(--radius-xs)]"
      >
        Try again
      </button>
    </div>
  );
}

export function UsageHeatmap({ data, year, granularity, mode, onDayClick }: UsageHeatmapProps) {
  const normalized = useMemo(
    () => data.map((d) => ({ date: d.date, count: asCount(d, mode) })),
    [data, mode],
  );

  const safeYear = Number.isFinite(year) ? Math.trunc(year) : new Date().getUTCFullYear();

  if (granularity === 'monthly') return <MonthlyView data={normalized} year={safeYear} />;
  if (granularity === 'weekly') return <WeeklyView data={normalized} year={safeYear} />;
  return <DailyView data={normalized} year={safeYear} onDayClick={onDayClick} />;
}
