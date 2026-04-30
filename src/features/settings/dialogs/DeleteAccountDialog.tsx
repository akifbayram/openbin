import { lazy, Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioOption } from '@/components/ui/radio-option';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { usePlan } from '@/lib/usePlan';
import { cn, getErrorMessage } from '@/lib/utils';
import type { CheckoutAction } from '@/types';

const DELETION_GRACE_PERIOD_DAYS = 30;
const CONFIRM_PHRASE = 'delete my account';

type Step = 'summary' | 'subscription' | 'confirm';
type RefundPolicy = 'none' | 'prorated';

const CheckoutLink = __EE__
  ? lazy(() => import('@/ee/checkoutAction').then(m => ({ default: m.CheckoutLink })))
  : (() => null) as React.FC<{ action: CheckoutAction; className?: string; children: React.ReactNode; target?: '_self' | '_blank' }>;

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const { user, deleteAccount } = useAuth();
  const { planInfo, isSelfHosted } = usePlan();
  const { showToast } = useToast();

  const hasPassword = user?.hasPassword !== false;
  const hasActiveSub =
    !isSelfHosted &&
    !!user &&
    user.plan !== undefined &&
    user.plan !== 'free' &&
    user.subscriptionStatus === 'active';

  const [step, setStep] = useState<Step>('summary');
  const [refundPolicy, setRefundPolicy] = useState<RefundPolicy>('none');
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Defer reset slightly so exit animation isn't disturbed
      const id = window.setTimeout(() => {
        setStep('summary');
        setRefundPolicy('none');
        setConfirmText('');
        setPassword('');
        setSubmitting(false);
        setError(null);
      }, 200);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  if (!user) return null;

  const totalSteps = hasActiveSub ? 3 : 2;
  const stepNumber = step === 'summary' ? 1 : step === 'subscription' ? 2 : hasActiveSub ? 3 : 2;

  function goNext() {
    setError(null);
    if (step === 'summary') {
      setStep(hasActiveSub ? 'subscription' : 'confirm');
    } else if (step === 'subscription') {
      setStep('confirm');
    }
  }

  function goBack() {
    setError(null);
    if (step === 'confirm') {
      setStep(hasActiveSub ? 'subscription' : 'summary');
    } else if (step === 'subscription') {
      setStep('summary');
    }
  }

  const confirmTextValid = confirmText === CONFIRM_PHRASE;
  const passwordValid = !hasPassword || password.length > 0;
  const canSubmit = confirmTextValid && passwordValid && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await deleteAccount(
        hasPassword ? password : undefined,
        refundPolicy,
      );
      showToast({
        message: result.scheduledAt
          ? `Account scheduled for deletion on ${new Date(result.scheduledAt).toLocaleDateString()}`
          : 'Account deleted',
        variant: 'success',
      });
      // auth state already cleared by deleteAccount
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete account'));
      setSubmitting(false);
    }
  }

  const planLabel = user.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : '';
  const periodLabel = planInfo?.billingPeriod ?? 'monthly';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 mb-1">
            <DialogTitle>
              {step === 'summary' && 'Delete Account'}
              {step === 'subscription' && 'Cancel Subscription'}
              {step === 'confirm' && 'Confirm Account Deletion'}
            </DialogTitle>
            <span className="text-[12px] text-[var(--text-tertiary)] shrink-0">
              Step {stepNumber} of {totalSteps}
            </span>
          </div>
          {step === 'summary' && (
            <DialogDescription>
              You're about to delete <span className="font-medium text-[var(--text-secondary)]">{user.email}</span>.
            </DialogDescription>
          )}
          {step === 'subscription' && (
            <DialogDescription>
              Choose how to handle your active subscription.
            </DialogDescription>
          )}
          {step === 'confirm' && (
            <DialogDescription>
              This action will be irreversible after the {DELETION_GRACE_PERIOD_DAYS}-day recovery window.
            </DialogDescription>
          )}
        </DialogHeader>

        {error && (
          <div
            role="alert"
            className="mb-4 px-3.5 py-2.5 rounded-[var(--radius-md)] bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 text-[13px] text-[var(--destructive)]"
          >
            {error}
          </div>
        )}

        {step === 'summary' && (
          <div className="space-y-4">
            <div className="space-y-2 text-[14px] text-[var(--text-secondary)]">
              <p>
                This will permanently delete your account in{' '}
                <span className="font-medium text-[var(--text-primary)]">{DELETION_GRACE_PERIOD_DAYS} days</span>.
              </p>
              <p>You can recover your account by signing in until then.</p>
            </div>
            <div>
              <p className="text-[13px] font-medium text-[var(--text-primary)] mb-2">What will be deleted:</p>
              <ul className="text-[13px] text-[var(--text-secondary)] list-disc pl-5 space-y-1">
                <li>All bins and items in locations where you are the only member</li>
                <li>All photos and attachments you uploaded</li>
                <li>Your API keys and personal settings</li>
                <li>Locations shared with others will be preserved</li>
              </ul>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={goNext}>
                Continue
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'subscription' && (
          <div className="space-y-4">
            <p className="text-[14px] text-[var(--text-secondary)]">
              You have an active{' '}
              <span className="font-medium text-[var(--text-primary)]">{planLabel}</span> subscription billing{' '}
              <span className="font-medium text-[var(--text-primary)]">{periodLabel}</span>.
            </p>
            <div className="space-y-2">
              <RadioOption
                selected={refundPolicy === 'none'}
                onClick={() => setRefundPolicy('none')}
                label="Cancel and stop billing now"
                description="No refund for the unused time."
              />
              <RadioOption
                selected={refundPolicy === 'prorated'}
                onClick={() => setRefundPolicy('prorated')}
                label="Cancel and refund the unused time"
                description="A prorated refund will be issued for the remainder of the billing period."
              />
            </div>
            {planInfo?.portalAction && __EE__ && (
              <p className="text-[12px] text-[var(--text-tertiary)]">
                Or just{' '}
                <Suspense fallback={<span>cancel your subscription</span>}>
                  <CheckoutLink
                    action={planInfo.portalAction}
                    target="_blank"
                    className="text-[var(--accent)] hover:underline"
                  >
                    cancel your subscription
                  </CheckoutLink>
                </Suspense>{' '}
                without deleting your account.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={goBack}>
                Back
              </Button>
              <Button type="button" variant="destructive" onClick={goNext}>
                Continue
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'confirm' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-phrase">
                Type <span className="font-mono text-[var(--text-primary)]">{CONFIRM_PHRASE}</span> to confirm
              </Label>
              <Input
                id="confirm-phrase"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                placeholder={CONFIRM_PHRASE}
                aria-invalid={confirmText.length > 0 && !confirmTextValid}
              />
            </div>
            {hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Enter your password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Password"
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={goBack} disabled={submitting}>
                Back
              </Button>
              <Button type="submit" variant="destructive" disabled={!canSubmit}>
                {submitting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DeletionPendingBannerProps {
  scheduledAt: string;
}

export function DeletionPendingBanner({ scheduledAt }: DeletionPendingBannerProps) {
  const date = new Date(scheduledAt).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <output
      className={cn(
        'block mb-4 px-4 py-3 rounded-[var(--radius-md)]',
        'bg-[var(--destructive)]/8 border border-[var(--destructive)]/30',
        'text-[13px] text-[var(--text-secondary)]',
      )}
    >
      <p className="font-medium text-[var(--destructive)] mb-1">Account scheduled for deletion</p>
      <p>
        Your account is scheduled for deletion on{' '}
        <span className="font-medium text-[var(--text-primary)]">{date}</span>. Sign back in before then to recover it.
      </p>
    </output>
  );
}
