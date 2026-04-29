import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckoutLink } from '@/ee/checkoutAction';
import { usePlan } from '@/lib/usePlan';
import { cn, focusRing } from '@/lib/utils';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  description?: string;
}

export function UpgradeDialog({ open, onOpenChange, feature, description }: UpgradeDialogProps) {
  const { isFree, isPlus, isLocked, planInfo } = usePlan();
  const isActiveFreeOrPlus = (isFree || isPlus) && !isLocked;
  const upgradeAction = planInfo.upgradeAction;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--accent)]/10 mb-3 mx-auto sm:mx-0">
            <Sparkles className="h-6 w-6 text-[var(--accent)]" />
          </div>
          <DialogTitle>
            {isActiveFreeOrPlus
              ? `Upgrade to unlock ${feature}`
              : `${feature} requires Pro`}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          {upgradeAction && (
            <CheckoutLink
              action={upgradeAction}
              target="_blank"
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] h-10 px-5 text-[14px] font-semibold text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] transition-colors',
                focusRing,
              )}
            >
              Upgrade
              <ArrowUpRight className="h-3.5 w-3.5" />
            </CheckoutLink>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
