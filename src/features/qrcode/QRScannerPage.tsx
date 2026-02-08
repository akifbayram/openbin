import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, AlertCircle, RotateCcw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Html5QrcodePlugin } from './Html5QrcodePlugin';
import { db } from '@/db';
import { haptic } from '@/lib/utils';
import { BinCreateDialog } from '@/features/bins/BinCreateDialog';

const BIN_URL_REGEX = /#\/bin\/([a-f0-9-]{36})/i;

export function QRScannerPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(true);
  const [unknownId, setUnknownId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleScan = useCallback(
    async (decodedText: string) => {
      const match = decodedText.match(BIN_URL_REGEX);
      if (match) {
        const binId = match[1];
        haptic();
        setScanning(false);
        const bin = await db.bins.get(binId);
        if (bin) {
          navigate(`/bin/${binId}`);
        } else {
          setUnknownId(binId);
        }
      } else {
        setScanning(false);
        setError(decodedText);
      }
    },
    [navigate]
  );

  function handleRetry() {
    setError('');
    setUnknownId(null);
    setScanning(true);
  }

  return (
    <div className="flex flex-col gap-4 px-[var(--page-px)] pt-6 pb-2">
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
                <p className="text-[17px] font-semibold text-[var(--text-primary)]">Not a Bin QR Code</p>
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
                <p className="text-[17px] font-semibold text-[var(--text-primary)]">Bin Not Found</p>
                <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">
                  This QR code points to a bin that doesn't exist yet.
                </p>
              </div>
              <div className="flex gap-2.5 mt-1">
                <Button variant="outline" onClick={handleRetry} className="rounded-[var(--radius-full)]">
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Scan Again
                </Button>
                <Button onClick={() => setCreateOpen(true)} className="rounded-[var(--radius-full)]">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Bin
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : scanning ? (
        <Card className="overflow-hidden">
          <CardContent className="py-5">
            <Html5QrcodePlugin onScanSuccess={handleScan} />
            <p className="mt-5 text-center text-[13px] text-[var(--text-tertiary)]">
              Point your camera at a bin QR code
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center justify-center py-20 text-[var(--text-tertiary)]">
          Redirecting...
        </div>
      )}

      <BinCreateDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) handleRetry();
        }}
      />
    </div>
  );
}
