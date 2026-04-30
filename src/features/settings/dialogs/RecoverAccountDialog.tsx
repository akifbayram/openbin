import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/utils';

export interface RecoverAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  password: string;
  scheduledAt: string;
  onRecovered: () => Promise<void> | void;
}

export function RecoverAccountDialog({
  open,
  onOpenChange,
  email,
  password,
  scheduledAt,
  onRecovered,
}: RecoverAccountDialogProps) {
  const { recoverAccount } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleRecover() {
    setError('');
    setSubmitting(true);
    try {
      await recoverAccount(email, password);
      onOpenChange(false);
      await onRecovered();
    } catch (err) {
      setError(getErrorMessage(err, 'Recovery failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const scheduledDate = new Date(scheduledAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account scheduled for deletion</DialogTitle>
          <DialogDescription>
            This account is scheduled for permanent deletion on {scheduledDate}. Recover it now to continue using your account.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <output role="alert" className="block text-[13px] text-[var(--destructive)] bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 px-3.5 py-2.5 rounded-[var(--radius-md)]">
            {error}
          </output>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleRecover} disabled={submitting}>
            {submitting ? 'Recovering...' : 'Recover account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
