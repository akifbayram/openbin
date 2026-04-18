import { useEffect, useState } from 'react';
import { generateQRDataURL, type QRColorOptions } from '@/lib/qr';

interface QRCodeDisplayProps {
  binId: string;
  size?: number;
  /** Show short code text below the QR image, sized to fill the QR width. */
  shortCode?: string;
  colors?: QRColorOptions;
  containerStyle?: React.CSSProperties;
  shortCodeStyle?: React.CSSProperties;
}

export function QRCodeDisplay({ binId, size = 200, shortCode, colors, containerStyle, shortCodeStyle }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    generateQRDataURL(binId, size, colors).then(setDataUrl);
  }, [binId, size, colors?.dark, colors?.light]);

  if (!dataUrl) return null;

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="rounded-[var(--radius-lg)] bg-[var(--bg-print-surface)] p-3.5 border border-[var(--border-flat)] flex flex-col items-center"
        style={containerStyle}
      >
        <img src={dataUrl} alt="QR Code" width={size} height={size} />
        {shortCode && (
          <p
            className="font-mono font-bold tracking-wider text-[var(--text-tertiary)] text-center"
            style={{ fontSize: `${size / (shortCode.length * 0.6 + (shortCode.length - 1) * 0.2)}px`, ...shortCodeStyle }}
          >
            {shortCode}
          </p>
        )}
      </div>
    </div>
  );
}
