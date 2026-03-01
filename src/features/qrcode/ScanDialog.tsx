import { AlertCircle, Plus, RotateCcw, ScanLine, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BinCreateDialog } from '@/features/bins/BinCreateDialog';
import { lookupBinByCode } from '@/features/bins/useBins';
import { recordScan } from '@/features/dashboard/scanHistory';
import { ScanSuccessOverlay } from '@/features/onboarding/ScanSuccessOverlay';
import { useOnboarding } from '@/features/onboarding/useOnboarding';
import { apiFetch } from '@/lib/api';
import { BIN_URL_REGEX } from '@/lib/qr';
import { useTerminology } from '@/lib/terminology';
import { haptic } from '@/lib/utils';
import { Html5QrcodePlugin } from './Html5QrcodePlugin';

interface ScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScanDialog({ open, onOpenChange }: ScanDialogProps) {
  const t = useTerminology();
  const navigate = useNavigate();
  const { firstScanDone, markFirstScanDone } = useOnboarding();
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(true);
  const [unknownId, setUnknownId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [successBinId, setSuccessBinId] = useState<string | null>(null);

  // Reset all state when dialog opens
  useEffect(() => {
    if (open) {
      setError('');
      setUnknownId(null);
      setManualCode('');
      setManualError('');
      setManualLoading(false);
      setScanning(true);
      setSuccessBinId(null);
    }
  }, [open]);

  async function handleManualLookup() {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setManualError('');
    setManualLoading(true);
    try {
      const bin = await lookupBinByCode(code);
      haptic();
      recordScan(bin.id);
      onOpenChange(false);
      navigate(`/bin/${bin.id}`);
    } catch {
      setManualError(`No ${t.bin} found with that code`);
    } finally {
      setManualLoading(false);
    }
  }

  const handleScan = useCallback(
    async (decodedText: string) => {
      const match = decodedText.match(BIN_URL_REGEX);
      if (match) {
        const binId = match[1];
        haptic();
        setScanning(false);
        try {
          await apiFetch(`/api/bins/${binId}`);
          recordScan(binId);
          if (!firstScanDone) {
            markFirstScanDone();
            onOpenChange(false);
            setSuccessBinId(binId);
          } else {
            onOpenChange(false);
            navigate(`/bin/${binId}`);
          }
        } catch {
          setUnknownId(binId);
        }
      } else {
        setScanning(false);
        setError(decodedText);
      }
    },
    [navigate, firstScanDone, markFirstScanDone, onOpenChange],
  );

  function handleRetry() {
    setError('');
    setUnknownId(null);
    setScanning(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
          </DialogHeader>

          {error ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="h-14 w-14 rounded-full bg-[var(--destructive)] bg-opacity-10 flex items-center justify-center">
                    <AlertCircle className="h-7 w-7 text-[var(--destructive)]" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[17px] font-semibold text-[var(--text-primary)]">Not a {t.Bin} QR Code</p>
                    <p className="text-[13px] text-[var(--text-tertiary)] break-all max-w-xs mx-auto leading-relaxed">{error}</p>
                  </div>
                  <Button variant="outline" onClick={handleRetry} className="rounded-[var(--radius-full)] mt-1">
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Scan Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : unknownId ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="h-14 w-14 rounded-full bg-[var(--accent)] bg-opacity-10 flex items-center justify-center">
                    <ScanLine className="h-7 w-7 text-[var(--accent)]" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[17px] font-semibold text-[var(--text-primary)]">{t.Bin} Not Found</p>
                    <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">
                      This QR code points to a {t.bin} that doesn't exist yet.
                    </p>
                  </div>
                  <div className="flex gap-2.5 mt-1">
                    <Button variant="outline" onClick={handleRetry} className="rounded-[var(--radius-full)]">
                      <RotateCcw className="h-4 w-4 mr-1.5" />
                      Scan Again
                    </Button>
                    <Button onClick={() => setCreateOpen(true)} className="rounded-[var(--radius-full)]">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Create {t.Bin}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="py-5">
                {open && <Html5QrcodePlugin paused={!scanning} onScanSuccess={handleScan} />}
                {scanning && (
                  <p className="mt-5 text-center text-[13px] text-[var(--text-tertiary)]">
                    Point your camera at a {t.bin} QR code
                  </p>
                )}
                {!scanning && (
                  <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)]">
                    Redirecting...
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Manual lookup by short code */}
          <div className="mt-4">
            <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal mb-3 block">
              Manual Lookup
            </Label>
            <div className="flex gap-2">
              <Input
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value.toUpperCase());
                  setManualError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleManualLookup();
                  }
                }}
                placeholder={`Enter ${t.bin} code`}
                maxLength={6}
                disabled={manualLoading}
                className="flex-1 font-mono uppercase tracking-widest"
              />
              <Button
                onClick={handleManualLookup}
                disabled={!manualCode.trim() || manualLoading}
                className="rounded-[var(--radius-md)] shrink-0"
              >
                <Search className="h-4 w-4 mr-1.5" />
                Look Up
              </Button>
            </div>
            {manualError && (
              <p className="mt-2 text-[13px] text-[var(--destructive)]">{manualError}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BinCreateDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) handleRetry();
        }}
      />

      {successBinId &&
        createPortal(
          <ScanSuccessOverlay onDismiss={() => navigate(`/bin/${successBinId}`)} />,
          document.body,
        )}
    </>
  );
}
