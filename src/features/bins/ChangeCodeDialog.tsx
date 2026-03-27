import { Keyboard, Loader2, QrCode } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { BIN_URL_REGEX } from '@/lib/qr';
import { cn } from '@/lib/utils';
import { changeCode, lookupBinByCodeSafe } from './useBins';

interface ChangeCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'adopt' | 'reassign';
  currentBin: { id: string; name: string };
}

type Step = 'input' | 'confirm' | 'submitting';
type InputMode = 'manual' | 'scan';

interface LookupResult {
  code: string;
  claimed: boolean;
  binName?: string;
}

const CODE_REGEX = /^[A-Z0-9]{4,8}$/;

export function ChangeCodeDialog({ open, onOpenChange, mode, currentBin }: ChangeCodeDialogProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('input');
  const [inputMode, setInputMode] = useState<InputMode>('manual');
  const [code, setCode] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('input');
      setInputMode('manual');
      setCode('');
      setLookupResult(null);
      setLookingUp(false);
      setError('');
    }
  }, [open]);

  const isValidCode = CODE_REGEX.test(code) && code !== currentBin.id;

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
      // In adopt mode: current bin adopts the entered code
      // In reassign mode: the entered code's bin adopts current bin's code
      const targetBinId = mode === 'adopt' ? currentBin.id : lookupResult.code;
      const newCode = mode === 'adopt' ? lookupResult.code : currentBin.id;

      const result = await changeCode(targetBinId, newCode);

      onOpenChange(false);
      showToast({ message: `Code changed to ${result.id}` });

      // Navigate to the bin with its new code
      navigate(`/bin/${result.id}`, { replace: true });
    } catch {
      setError('Failed to change code. Please try again.');
      setStep('confirm');
    }
  }

  // Scanner callback
  const handleScan = useCallback((decodedText: string) => {
    const match = decodedText.match(BIN_URL_REGEX);
    if (match) {
      const scannedCode = match[1].toUpperCase();
      setCode(scannedCode);
      setInputMode('manual');
    }
  }, []);

  const title = mode === 'adopt' ? 'Change Code' : 'Reassign Code';
  const description = mode === 'adopt'
    ? 'Scan or enter the code from the label you want this bin to use.'
    : `Enter the code of the bin that should receive code ${currentBin.id}.`;

  const handleOpenChange = (next: boolean) => {
    if (step === 'submitting') return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-2">
            {/* Input mode toggle */}
            <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-flat)]">
              <button
                type="button"
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[13px] font-medium transition-colors',
                  inputMode === 'manual'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
                onClick={() => setInputMode('manual')}
              >
                <Keyboard className="h-3.5 w-3.5" />
                Enter Code
              </button>
              <button
                type="button"
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[13px] font-medium transition-colors',
                  inputMode === 'scan'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
                onClick={() => setInputMode('scan')}
              >
                <QrCode className="h-3.5 w-3.5" />
                Scan QR
              </button>
            </div>

            {inputMode === 'manual' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
                    setError('');
                  }}
                  placeholder="Enter code..."
                  maxLength={8}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--border-flat)] bg-[var(--bg-input)] px-3.5 py-2.5 text-base font-mono tracking-wider text-center uppercase text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  autoComplete="off"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && isValidCode && !lookingUp) handleLookup(); }}
                />
                {code && code === currentBin.id && (
                  <p className="text-[13px] text-[var(--destructive)]">This is already this bin&apos;s code.</p>
                )}
              </div>
            ) : (
              <ScannerPanel onScan={handleScan} />
            )}

            {error && (
              <p className="text-[13px] text-[var(--destructive)]">{error}</p>
            )}
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
              <>
                <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button
                  onClick={handleLookup}
                  disabled={!isValidCode || lookingUp}
                  aria-label="Look up"
                >
                  {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Look Up'}
                </Button>
              </>
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

/** Lazy-loaded QR scanner panel. Only mounts the camera when this tab is active. */
function ScannerPanel({ onScan }: { onScan: (text: string) => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<unknown>(null);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    let stopped = false;

    async function startScanner() {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (stopped || !scannerRef.current) return;

      const scanner = new Html5Qrcode(scannerRef.current.id);
      html5QrRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan(decodedText);
            scanner.stop().catch(() => {});
          },
          () => {},
        );
      } catch {
        setScanError('Camera access denied or not available.');
      }
    }

    startScanner();

    return () => {
      stopped = true;
      const scanner = html5QrRef.current as { stop?: () => Promise<void> } | null;
      scanner?.stop?.().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="space-y-2">
      <div
        id="change-code-scanner"
        ref={scannerRef}
        className="w-full aspect-square max-h-[300px] rounded-lg overflow-hidden bg-black"
      />
      {scanError && (
        <p className="text-[13px] text-[var(--destructive)]">{scanError}</p>
      )}
    </div>
  );
}
