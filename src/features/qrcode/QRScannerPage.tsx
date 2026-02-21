import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, AlertCircle, RotateCcw, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Html5QrcodePlugin } from './Html5QrcodePlugin';
import { apiFetch } from '@/lib/api';
import { haptic } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { lookupBinByCode } from '@/features/bins/useBins';
import { BinCreateDialog } from '@/features/bins/BinCreateDialog';
import { ScanSuccessOverlay } from '@/features/onboarding/ScanSuccessOverlay';
import { useOnboarding } from '@/features/onboarding/useOnboarding';
import { recordScan } from '@/features/dashboard/scanHistory';
import { BIN_URL_REGEX } from '@/lib/qr';

export function QRScannerPage() {
  const t = useTerminology();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { firstScanDone, markFirstScanDone } = useOnboarding();
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(true);
  const [unknownId, setUnknownId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [successBinId, setSuccessBinId] = useState<string | null>(null);

  async function handleManualLookup() {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setManualError('');
    setManualLoading(true);
    try {
      const bin = await lookupBinByCode(code);
      haptic();
      recordScan(bin.id);
      navigate(`/bin/${bin.id}`, { state: { backLabel: 'Scan', backPath: '/scan' } });
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
            setSuccessBinId(binId);
          } else {
            navigate(`/bin/${binId}`, { state: { backLabel: 'Scan', backPath: '/scan' } });
          }
        } catch {
          setUnknownId(binId);
        }
      } else {
        setScanning(false);
        setError(decodedText);
      }
    },
    [navigate, user, firstScanDone, markFirstScanDone]
  );

  function handleRetry() {
    setError('');
    setUnknownId(null);
    setScanning(true);
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2 max-w-2xl mx-auto">
      <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
        Scan
      </h1>

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
            <Html5QrcodePlugin paused={!scanning} onScanSuccess={handleScan} />
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
      <Card>
        <CardContent>
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
        </CardContent>
      </Card>

      <BinCreateDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) handleRetry();
        }}
      />

      {successBinId && (
        <ScanSuccessOverlay onDismiss={() => navigate(`/bin/${successBinId}`, { state: { backLabel: 'Scan', backPath: '/scan' } })} />
      )}
    </div>
  );
}
