import { useEffect, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';

interface Html5QrcodePluginProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: string) => void;
}

export function Html5QrcodePlugin({ onScanSuccess, onScanFailure }: Html5QrcodePluginProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'html5-qrcode-scanner';
  const [loading, setLoading] = useState(true);

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
          console.error('Scanner start error:', err);
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

  return (
    <>
      {loading && (
        <div className="flex items-center justify-center py-12 text-[var(--text-tertiary)] text-[13px]">
          Loading scanner…
        </div>
      )}
      <div id={containerId} className="w-full" />
    </>
  );
}
