import { AlertTriangle, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminMetrics } from './useAdminMetrics';

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
      <span className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wide">{label}</span>
      <span className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{value}</span>
      {sub && <span className="text-[12px] text-[var(--text-muted)]">{sub}</span>}
    </div>
  );
}

export function AdminMetricsSection() {
  const { metrics, error } = useAdminMetrics();

  if (error) return null;
  if (!metrics) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center gap-1.5 mb-3">
            <Skeleton className="h-3.5 w-3.5" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity
              <div key={i} className="flex flex-col gap-1.5 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-input)]">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const featureNames: Record<string, string> = {
    ai: 'AI',
    apiKeys: 'API Keys',
    customFields: 'Custom Fields',
    binSharing: 'Bin Sharing',
    reorganize: 'Reorganize',
  };

  return (
    <Card>
      <CardContent>
        <p className="text-[15px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5 mb-3">
          <BarChart3 className="h-3.5 w-3.5" />
          Cloud Metrics
        </p>

        {/* Warnings */}
        {metrics.warnings.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {metrics.warnings.map((w) => (
              <div key={w} className="flex items-start gap-2 p-2.5 rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] ring-1 ring-[var(--color-warning-ring)] text-[13px] text-[var(--text-secondary)]">
                <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Plan distribution */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
          <MetricCard label="Total Users" value={metrics.plans.total} />
          <MetricCard label="Pro Active" value={metrics.plans.proActive} />
          <MetricCard label="Pro Trial" value={metrics.plans.proTrial} />
          <MetricCard label="Lite Active" value={metrics.plans.liteActive} />
          <MetricCard label="Trial Conv." value={`${metrics.trialConversion.rate}%`} sub={`${metrics.trialConversion.converted}/${metrics.trialConversion.started}`} />
        </div>

        {/* Usage */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
          <MetricCard label="Total Bins" value={metrics.bins.total ?? 0} sub={`+${metrics.bins.createdLast7d ?? 0} this week`} />
          <MetricCard label="Avg Bins/Loc" value={metrics.bins.avgPerLocation} />
          <MetricCard label="Storage" value={`${metrics.storage.totalMb} MB`} sub={`${metrics.storage.avgPerLocationMb} MB avg`} />
          <MetricCard label="Near Limit" value={metrics.storage.nearingLimitCount} sub="locations >90% storage" />
        </div>

        {/* Feature adoption */}
        <p className="text-[13px] font-medium text-[var(--text-secondary)] mb-2">Feature Adoption (30d)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.entries(metrics.featureAdoption).map(([key, val]) => (
            <MetricCard key={key} label={featureNames[key] || key} value={`${val.percentage}%`} sub={`${val.usersOrLocations} users/locs`} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
