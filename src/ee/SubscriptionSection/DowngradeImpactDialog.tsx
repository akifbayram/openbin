import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useMountOnOpen } from '@/lib/useMountOnOpen';
import { useDowngrade } from './hooks/useDowngrade';
import { useDowngradeImpact } from './hooks/useDowngradeImpact';

interface DowngradeImpactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan: 'free' | 'plus';
  onConfirmed: () => void;
}

const TARGET_LABEL: Record<'free' | 'plus', string> = { free: 'Free', plus: 'Plus' };

export function DowngradeImpactDialog(props: DowngradeImpactDialogProps) {
  const { open, onOpenChange, targetPlan, onConfirmed } = props;
  const mounted = useMountOnOpen(open);

  const targetForFetch = mounted ? targetPlan : null;
  const { impact, isLoading, error, refetch } = useDowngradeImpact(targetForFetch);
  const { downgrade, isPending } = useDowngrade();

  const handleConfirm = async () => {
    try {
      const outcome = await downgrade(targetPlan);
      // The tab is navigating away; leave the dialog mounted so the disabled state holds until unload.
      if (outcome === 'redirected') return;
      onConfirmed();
      onOpenChange(false);
    } catch {
      // swallowed
    }
  };

  const labels = targetPlan === 'free'
    ? { confirm: 'Cancel subscription', pending: 'Cancelling…' }
    : { confirm: 'Change plan', pending: 'Switching…' };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch to {TARGET_LABEL[targetPlan]} Plan?</DialogTitle>
        </DialogHeader>

        {!mounted ? null : isLoading ? (
          <div className="py-6 space-y-2">
            <Skeleton className="h-4" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : error ? (
          <div className="py-4 space-y-2">
            <p className="text-sm text-red-600 dark:text-red-400">Couldn't load impact preview.</p>
            <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
          </div>
        ) : impact && impact.warnings.length > 0 ? (
          <div className="py-2 space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">Here's what changes after you downgrade:</p>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {impact.warnings.map((w, idx) => (
                <li key={`${w.kind}-${idx}`} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    {w.kind === 'usage-exceeded' && (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                    )}
                    {w.title}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{w.description}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--text-tertiary)]">
              Your subscription remains active until your renewal date. You'll switch to {TARGET_LABEL[targetPlan]} after that.
            </p>
          </div>
        ) : (
          <p className="py-4 text-sm text-[var(--text-secondary)]">Nothing changes after downgrade.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isLoading || isPending}>
            {isPending ? labels.pending : labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
