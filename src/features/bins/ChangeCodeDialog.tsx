import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { BIN_CODE_REGEX } from '@/lib/qr';
import { changeCode, lookupBinByCodeSafe } from './useBins';

interface ChangeCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBin: { id: string; short_code: string; name: string };
}

type Step = 'input' | 'confirm' | 'submitting';

export function ChangeCodeDialog({ open, onOpenChange, currentBin }: ChangeCodeDialogProps) {
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('input');
  const [code, setCode] = useState('');
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('input');
      setCode('');
      setConfirmedCode(null);
      setLookingUp(false);
      setError('');
    }
  }, [open]);

  const isValidCode = BIN_CODE_REGEX.test(code) && code !== currentBin.short_code;

  async function handleLookup() {
    if (!isValidCode) return;
    setLookingUp(true);
    setError('');

    try {
      const result = await lookupBinByCodeSafe(code);

      if (result.status === 'found') {
        setError('Code already in use.');
        setLookingUp(false);
        return;
      }

      setConfirmedCode(code);
      setStep('confirm');
    } catch {
      setError('Failed to look up code. Please try again.');
    } finally {
      setLookingUp(false);
    }
  }

  async function handleConfirm() {
    if (!confirmedCode) return;
    setStep('submitting');

    try {
      const result = await changeCode(currentBin.id, confirmedCode);

      onOpenChange(false);
      showToast({ message: `Code changed to ${result.short_code}` });
    } catch {
      setError('Failed to change code. Please try again.');
      setStep('confirm');
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (step === 'submitting') return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change Code</DialogTitle>
          <DialogDescription>Enter the new short code for this bin.</DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-2">
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] ring-1 ring-[var(--color-warning-ring)] px-3 py-2.5"
            >
              <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                Changing the code will invalidate any printed QR labels pointing to{' '}
                <span className="font-mono font-semibold text-[var(--text-primary)]">{currentBin.short_code}</span>
                . You&apos;ll need to reprint labels before they scan to this bin again.
              </p>
            </div>
            <div>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                    setError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValidCode && !lookingUp) {
                      e.preventDefault();
                      handleLookup();
                    }
                  }}
                  placeholder="Enter code..."
                  maxLength={6}
                  disabled={lookingUp}
                  className="flex-1 font-mono uppercase tracking-widest"
                />
                <Button
                  onClick={handleLookup}
                  disabled={!isValidCode || lookingUp}
                  className="rounded-[var(--radius-md)] shrink-0"
                >
                  {lookingUp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-1.5" />
                      Look Up
                    </>
                  )}
                </Button>
              </div>
              {code && code === currentBin.short_code && (
                <p className="mt-2 text-[13px] text-[var(--destructive)]">This is already this bin&apos;s code.</p>
              )}
              {error && (
                <p className="mt-2 text-[13px] text-[var(--destructive)]">{error}</p>
              )}
            </div>
          </div>
        )}

        {step === 'confirm' && confirmedCode && (
          <div className="py-4 space-y-3">
            <p className="text-sm text-[var(--text-primary)]">
              Change this bin&apos;s code from <span className="font-mono">{currentBin.short_code}</span> to <span className="font-mono font-semibold">{confirmedCode}</span>?
            </p>
            {error && (
              <p className="text-[13px] text-[var(--destructive)]">{error}</p>
            )}
          </div>
        )}

        {step === 'submitting' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />
          </div>
        )}

        {step !== 'submitting' && (
          <DialogFooter>
            {step === 'input' && (
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
            )}
            {step === 'confirm' && (
              <>
                <Button variant="ghost" onClick={() => { setStep('input'); setError(''); }}>Back</Button>
                <Button onClick={handleConfirm}>Change Code</Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
