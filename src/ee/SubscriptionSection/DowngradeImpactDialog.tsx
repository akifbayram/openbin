import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
      await downgrade(targetPlan);
      onConfirmed();
      onOpenChange(false);
    } catch {
      // error is captured in useDowngrade.error, surfaced via the UI's pending state
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch to {TARGET_LABEL[targetPlan]} Plan?</DialogTitle>
        </DialogHeader>

        {!mounted ? null : isLoading ? (
          <div className="py-6 space-y-2">
            <div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" />
            <div className="h-4 bg-[var(--bg-input)] rounded animate-pulse w-3/4" />
            <div className="h-4 bg-[var(--bg-input)] rounded animate-pulse w-1/2" />
          </div>
        ) : error ? (
          <div className="py-4 space-y-2">
            <p className="text-sm text-red-600 dark:text-red-400">Couldn't load impact preview.</p>
            <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
          </div>
        ) : impact && impact.warnings.length > 0 ? (
          <div className="py-2 space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">Here's what changes after you downgrade:</p>
            <ul className="space-y-3">
              {impact.warnings.map((w, idx) => (
                <li key={`${w.kind}-${idx}`} className="space-y-0.5">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {w.kind === 'usage-exceeded' && <span className="mr-1">⚠</span>}
                    {w.title}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">{w.description}</p>
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
            {isPending ? 'Switching…' : `Switch to ${TARGET_LABEL[targetPlan]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
