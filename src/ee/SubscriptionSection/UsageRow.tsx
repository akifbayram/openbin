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
    if (shouldHideMetric({ used: m.used, limit: m.limit })) return [];
    return [{ ...m, limit: m.limit as number }];
  });

  if (visible.length === 0) return null;

  // Surface the variable-cost note only when an AI credit row is being
  // shown — Free with 0 credits and self-hosted (null) skip it because
  // the hint would be misleading or irrelevant.
  const showVariableCostHint = aiCredits != null && aiCredits.limit > 0;

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-tertiary)]">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
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
      {showVariableCostHint && (
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
          AI cost varies by request — chat &amp; commands cost 1, photo analysis 5+ per image, reorganize 5+ per bin.
        </p>
      )}
    </div>
  );
}
