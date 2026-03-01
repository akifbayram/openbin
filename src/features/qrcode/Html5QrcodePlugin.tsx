import './html5qrcode-overrides.css';
import type { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';

interface Html5QrcodePluginProps {
  paused?: boolean;
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: string) => void;
}

export function Html5QrcodePlugin({ paused, onScanSuccess, onScanFailure }: Html5QrcodePluginProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'html5-qrcode-scanner';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled) return;

      setLoading(false);
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScanSuccess(decodedText);
          },
          (errorMessage) => {
            onScanFailure?.(errorMessage);
          }
        )
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to start camera');
          }
        });
    });

    return () => {
      cancelled = true;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      if (paused && scanner.isScanning) {
        scanner.pause(true);
      } else if (!paused && scanner.getState() === 3) {
        // State 3 = PAUSED in html5-qrcode
        scanner.resume();
      }
    } catch {
      // Scanner may not be fully initialized yet
    }
  }, [paused]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
        <p className="text-[15px] font-medium text-[var(--text-primary)]">Failed to start scanner</p>
        <p className="text-[13px] text-[var(--text-tertiary)]">{error}</p>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--bg-active)] border-t-[var(--accent)] animate-spin" />
        </div>
      )}
      <div id={containerId} className="w-full" />
    </>
  );
}
