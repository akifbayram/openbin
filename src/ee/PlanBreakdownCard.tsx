import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { type PlanBreakdownResponse, useAdminPlanBreakdown } from './useAdminPlanBreakdown';

interface MetricRow {
  label: string;
  key: keyof PlanBreakdownResponse['free'];
  format?: 'number' | 'mb' | 'pct' | 'credits';
  gatedPlans?: string[];
}

const ROWS: MetricRow[] = [
  { label: 'Users', key: 'userCount' },
  { label: 'Avg Bins', key: 'avgBins' },
  { label: 'Avg Items', key: 'avgItems' },
  { label: 'Avg Photos', key: 'avgPhotos' },
  { label: 'Avg Storage', key: 'avgStorageMb', format: 'mb' },
  { label: 'Avg Locations', key: 'avgLocations' },
  { label: 'Avg Members/Loc', key: 'avgMembersPerLocation' },
  { label: 'Avg AI Credits', key: 'avgAiCreditsUsed', format: 'credits', gatedPlans: ['free'] },
  { label: 'Avg API Keys', key: 'avgApiKeys', gatedPlans: ['free', 'plus'] },
  { label: 'Avg API Reqs (7d)', key: 'avgApiRequests7d', gatedPlans: ['free', 'plus'] },
  { label: 'Avg Scans (30d)', key: 'avgScans30d' },
  { label: 'At Bin Limit', key: 'atBinLimitPct', format: 'pct' },
  { label: 'At Storage Limit', key: 'atStorageLimitPct', format: 'pct' },
];

const PLANS = ['free', 'plus', 'pro'] as const;
const PLAN_LABELS: Record<string, string> = { free: 'Free', plus: 'Plus', pro: 'Pro' };

function formatValue(value: number, format: MetricRow['format'], tier?: PlanBreakdownResponse[(typeof PLANS)[number]]): string {
  switch (format) {
    case 'mb': return `${value} MB`;
    case 'pct': return `${value}%`;
    case 'credits': return tier?.aiCreditsLimit ? `${value} / ${tier.aiCreditsLimit}` : `${value}`;
    default: return String(value);
  }
}

export function PlanBreakdownCard() {
  const { breakdown, isLoading, error } = useAdminPlanBreakdown();

  if (error) return null;

  if (isLoading || !breakdown) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
              <div key={i} className="flex gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage by Plan</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop: horizontal table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="text-left py-2 pr-4 ui-col-header">Metric</th>
                {PLANS.map((p) => (
                  <th key={p} className="text-right py-2 px-3 ui-col-header">{PLAN_LABELS[p]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="py-2 pr-4 text-[var(--text-secondary)]">{row.label}</td>
                  {PLANS.map((plan) => {
                    const tier = breakdown[plan];
                    const isGated = row.gatedPlans?.includes(plan);
                    const val = tier[row.key] as number;
                    return (
                      <td key={plan} className={cn('text-right py-2 px-3 tabular-nums', isGated ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]')}>
                        {isGated ? '—' : formatValue(val, row.format, tier)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: vertical cards */}
        <div className="sm:hidden flex flex-col gap-3">
          {PLANS.map((plan) => {
            const tier = breakdown[plan];
            return (
              <div key={plan} className="rounded-[var(--radius-sm)] bg-[var(--bg-input)] p-3">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">{PLAN_LABELS[plan]} ({tier.userCount} users)</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {ROWS.filter((r) => r.key !== 'userCount').map((row) => {
                    const isGated = row.gatedPlans?.includes(plan);
                    const val = tier[row.key] as number;
                    return (
                      <div key={row.key} className="flex justify-between text-[13px]">
                        <span className="text-[var(--text-tertiary)]">{row.label}</span>
                        <span className={cn('tabular-nums', isGated ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]')}>
                          {isGated ? '—' : formatValue(val, row.format, tier)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
