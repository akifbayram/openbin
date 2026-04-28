import { ProgressBar } from '@/components/ui/progress-bar';
import type { PlanFeatures, PlanInfo, PlanUsage } from '@/types';
import { shouldHideMetric, tone } from './hideRule';

interface UsageStripProps {
  usage: PlanUsage;
  features: PlanFeatures;
  aiCredits: PlanInfo['aiCredits'];
}

interface MetricRow {
  label: string;
  used: number;
  limit: number | null;
  formatValue?: (used: number, limit: number) => string;
}

export function UsageStrip({ usage, features, aiCredits }: UsageStripProps) {
  const maxMembers = Math.max(0, ...Object.values(usage.memberCounts ?? {}));

  const candidates: MetricRow[] = [
    { label: 'Bins',         used: usage.binCount,       limit: features.maxBins },
    { label: 'Locations',    used: usage.locationCount,  limit: features.maxLocations },
    { label: 'Members',      used: maxMembers,           limit: features.maxMembersPerLocation },
    {
      label: 'Photos',
      used: usage.photoStorageMb,
      limit: features.maxPhotoStorageMb,
      formatValue: (u, l) => `${u.toFixed(1)} / ${l} MB`,
    },
  ];

  if (aiCredits) {
    candidates.push({ label: 'AI this month', used: aiCredits.used, limit: aiCredits.limit });
  }

  // Explicit null check narrows TS inside the loop; shouldHideMetric also catches null but TS can't see through it.
  const visible = candidates.flatMap(m => {
    if (shouldHideMetric({ used: m.used, limit: m.limit }) || m.limit === null) return [];
    return [{ ...m, limit: m.limit }];
  });
  if (visible.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {visible.map(m => {
        const pct = m.limit > 0 ? (m.used / m.limit) * 100 : 0;
        const valueText = m.formatValue ? m.formatValue(m.used, m.limit) : `${m.used} / ${m.limit}`;
        return (
          <div key={m.label} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-tertiary)]">{m.label}</span>
              <span className="text-[var(--text-primary)] tabular-nums">{valueText}</span>
            </div>
            <ProgressBar value={pct} tone={tone(m.used, m.limit)} ariaLabel={`${m.label} usage`} />
          </div>
        );
      })}
    </div>
  );
}
