import { ArrowUpRight } from 'lucide-react';
import { usePlan } from '@/lib/usePlan';
import { cn, focusRing, isSafeExternalUrl } from '@/lib/utils';

interface UpgradePromptProps {
  feature: string;  // e.g. "AI Features", "API Keys"
  description?: string;  // Optional explanation
  upgradeUrl: string | null;
  className?: string;
}

export function UpgradePrompt({ feature, description, upgradeUrl, className }: UpgradePromptProps) {
  const { isFree, isPlus, isLocked } = usePlan();
  const isActiveFreeOrPlus = (isFree || isPlus) && !isLocked;

  return (
    <div className={cn(
      'flat-card rounded-[var(--radius-lg)] flex items-center justify-between gap-4 px-5 py-4',
      className
    )}>
      <div>
        <p className="text-[15px] font-semibold text-[var(--text-primary)]">
          {isActiveFreeOrPlus
            ? `Upgrade to Pro to unlock ${feature}`
            : `${feature} requires a Pro plan`}
        </p>
        {description && (
          <p className="text-[13px] text-[var(--text-tertiary)] mt-1">{description}</p>
        )}
      </div>
      {upgradeUrl && isSafeExternalUrl(upgradeUrl) && (
        <a
          href={upgradeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] h-10 px-4 text-[14px] font-semibold text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] transition-colors shrink-0', focusRing)}
        >
          Upgrade
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
