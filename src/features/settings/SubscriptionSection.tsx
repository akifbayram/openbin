import { ArrowUpRight, Clock, CreditCard } from 'lucide-react';
import { usePlan } from '@/lib/usePlan';
import { cn } from '@/lib/utils';

export function SubscriptionSection() {
  const { planInfo, isPro, isSelfHosted } = usePlan();

  // Don't render in self-hosted mode
  if (isSelfHosted) return null;

  const isTrialing = planInfo.status === 'trial';
  const isExpired = planInfo.status === 'inactive';
  const daysRemaining = planInfo.activeUntil
    ? Math.max(0, Math.ceil((new Date(planInfo.activeUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Subscription</h2>
      <div className="flat-card p-4 space-y-3">
        {/* Plan status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="text-sm font-medium">
              {isPro ? 'Pro' : 'Lite'} Plan
            </span>
            {isTrialing && (
              <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                Trial
              </span>
            )}
          </div>
          {planInfo.upgradeUrl && (
            <a
              href={planInfo.upgradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
            >
              {isPro ? 'Manage' : 'Upgrade'}
              <ArrowUpRight className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Trial/expiry info */}
        {(isTrialing || isExpired) && daysRemaining !== null && (
          <div className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-xs',
            isExpired
              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          )}>
            <Clock className="h-3.5 w-3.5" />
            {isExpired
              ? 'Your trial has expired. Upgrade to continue using Pro features.'
              : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining in your trial`
            }
          </div>
        )}
      </div>
    </section>
  );
}
