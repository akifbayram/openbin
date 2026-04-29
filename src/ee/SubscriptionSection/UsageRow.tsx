import type { PlanFeatures, PlanInfo, PlanUsage } from '@/types';
import { shouldHideMetric } from './hideRule';

interface UsageRowProps {
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

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function UsageRow({ usage, features, aiCredits }: UsageRowProps) {
  const maxMembers = Math.max(0, ...Object.values(usage.memberCounts ?? {}));

  const candidates: MetricRow[] = [
    { label: 'bins',      used: usage.binCount,      limit: features.maxBins },
    { label: 'locations', used: usage.locationCount, limit: features.maxLocations },
    { label: 'members',   used: maxMembers,          limit: features.maxMembersPerLocation },
    {
      label: 'photos',
      used: usage.photoStorageMb,
      limit: features.maxPhotoStorageMb,
      formatValue: (u, l) => `${u.toFixed(1)}/${l} MB`,
    },
    ...(aiCredits ? [{ label: 'AI', used: aiCredits.used, limit: aiCredits.limit }] : []),
  ];

  const visible = candidates.flatMap((m) => {
    if (shouldHideMetric({ used: m.used, limit: m.limit }) || m.limit === null) return [];
    return [{ ...m, limit: m.limit }];
  });

  if (visible.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-tertiary)]">
      {visible.map((m) => (
        <span key={m.label}>
          {m.formatValue ? (
            m.formatValue(m.used, m.limit)
          ) : (
            <>
              <strong className="font-semibold text-[var(--text-secondary)]">
                {formatNumber(m.used)}
              </strong>
              {`/${formatNumber(m.limit)} ${m.label}`}
            </>
          )}
        </span>
      ))}
    </div>
  );
}
