import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpgradePromptProps {
  feature: string;  // e.g. "AI Features", "API Keys"
  description?: string;  // Optional explanation
  upgradeUrl: string | null;
  className?: string;
}

export function UpgradePrompt({ feature, description, upgradeUrl, className }: UpgradePromptProps) {
  return (
    <div className={cn(
      'flat-card flex items-center justify-between gap-4 p-4',
      className
    )}>
      <div>
        <p className="font-medium text-sm">
          {feature} requires a Pro plan
        </p>
        {description && (
          <p className="text-xs text-[var(--text-secondary)] mt-1">{description}</p>
        )}
      </div>
      {upgradeUrl && (
        <a
          href={upgradeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--text-on-accent)] hover:opacity-90 transition-opacity shrink-0"
        >
          Upgrade
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
