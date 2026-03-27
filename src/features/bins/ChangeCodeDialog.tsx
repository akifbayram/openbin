import { Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { OptionGroup } from '@/components/ui/option-group';
import { useToast } from '@/components/ui/toast';
import { Html5QrcodePlugin } from '@/features/qrcode/Html5QrcodePlugin';
import { BIN_CODE_REGEX, BIN_URL_REGEX } from '@/lib/qr';
import { changeCode, lookupBinByCodeSafe } from './useBins';

interface ChangeCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBin: { id: string; name: string };
}

type Mode = 'adopt' | 'reassign';
type Step = 'input' | 'confirm' | 'submitting';

interface LookupResult {
  code: string;
  claimed: boolean;
  binName?: string;
}

const MODE_OPTIONS = [
  { key: 'adopt' as const, label: 'Use a new code' },
  { key: 'reassign' as const, label: 'Give code away' },
];

export function ChangeCodeDialog({ open, onOpenChange, currentBin }: ChangeCodeDialogProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [mode, setMode] = useState<Mode>('adopt');
  const [step, setStep] = useState<Step>('input');
  const [code, setCode] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setMode('adopt');
      setStep('input');
      setCode('');
      setLookupResult(null);
      setLookingUp(false);
      setError('');
    }
  }, [open]);

  function handleModeChange(newMode: Mode) {
    setMode(newMode);
    setCode('');
    setLookupResult(null);
    setError('');
    setStep('input');
  }

  const isValidCode = BIN_CODE_REGEX.test(code) && code !== currentBin.id;

  async function handleLookup() {
    if (!isValidCode) return;
    setLookingUp(true);
    setError('');

    try {
      const result = await lookupBinByCodeSafe(code);

      if (result.status === 'forbidden') {
        setError('You do not have admin access to the location that owns this code.');
        setLookingUp(false);
        return;
      }

      if (mode === 'reassign' && result.status !== 'found') {
        setError('No bin found with that code.');
        setLookingUp(false);
        return;
      }

      setLookupResult({
        code,
        claimed: result.status === 'found',
        binName: result.bin?.name,
      });
      setStep('confirm');
    } catch {
      setError('Failed to look up code. Please try again.');
    } finally {
      setLookingUp(false);
    }
  }

  async function handleConfirm() {
    if (!lookupResult) return;
    setStep('submitting');

    try {
      const targetBinId = mode === 'adopt' ? currentBin.id : lookupResult.code;
      const newCode = mode === 'adopt' ? lookupResult.code : currentBin.id;

      const result = await changeCode(targetBinId, newCode);

      onOpenChange(false);
      showToast({ message: `Code changed to ${result.id}` });
      navigate(`/bin/${result.id}`, { replace: true });
    } catch {
      setError('Failed to change code. Please try again.');
      setStep('confirm');
    }
  }

  const handleScan = useCallback((decodedText: string) => {
    const match = decodedText.match(BIN_URL_REGEX);
    if (match) {
      setCode(match[1].toUpperCase());
    }
  }, []);

  const description = mode === 'adopt'
    ? 'Scan or enter the code from the label you want this bin to use.'
    : `Enter the code of the bin that should receive code ${currentBin.id}.`;

  const handleOpenChange = (next: boolean) => {
    if (step === 'submitting') return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change Code</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-2">
            <OptionGroup options={MODE_OPTIONS} value={mode} onChange={handleModeChange} size="sm" />

            {open && <Html5QrcodePlugin onScanSuccess={handleScan} />}

            <div>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
                    setError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValidCode && !lookingUp) {
                      e.preventDefault();
                      handleLookup();
                    }
                  }}
                  placeholder="Enter code..."
                  maxLength={8}
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
              {code && code === currentBin.id && (
                <p className="mt-2 text-[13px] text-[var(--destructive)]">This is already this bin&apos;s code.</p>
              )}
              {error && (
                <p className="mt-2 text-[13px] text-[var(--destructive)]">{error}</p>
              )}
            </div>
          </div>
        )}

        {step === 'confirm' && lookupResult && (
          <div className="py-4 space-y-3">
            <p className="text-sm text-[var(--text-primary)]">
              {mode === 'adopt' ? (
                lookupResult.claimed ? (
                  <>Code <span className="font-mono font-semibold">{lookupResult.code}</span> belongs to &apos;{lookupResult.binName}&apos;. Adopting it will <strong>permanently delete</strong> that bin and change this bin&apos;s code from <span className="font-mono">{currentBin.id}</span> to <span className="font-mono">{lookupResult.code}</span>.</>
                ) : (
                  <>Change this bin&apos;s code from <span className="font-mono">{currentBin.id}</span> to <span className="font-mono font-semibold">{lookupResult.code}</span>?</>
                )
              ) : (
                <>Code <span className="font-mono font-semibold">{currentBin.id}</span> will move to &apos;{lookupResult.binName}&apos;. This bin (&apos;{currentBin.name}&apos;) will be <strong>permanently deleted</strong>.</>
              )}
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
                <Button
                  onClick={handleConfirm}
                  variant={mode === 'reassign' || lookupResult?.claimed ? 'destructive' : 'default'}
                >
                  {mode === 'adopt' ? 'Change Code' : 'Reassign'}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
