import { Check, Copy, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getBinUrl } from '@/lib/constants';
import { generateQRDataURL, type QRColorOptions } from '@/lib/qr';

interface QRCodeDisplayProps {
  binId: string;
  size?: number;
  /** Show short code text below the QR image, sized to fill the QR width. */
  shortCode?: string;
  /** Hide the copy/print action buttons below the QR code. */
  hideActions?: boolean;
  colors?: QRColorOptions;
  containerStyle?: React.CSSProperties;
  shortCodeStyle?: React.CSSProperties;
}

export function QRCodeDisplay({ binId, size = 200, shortCode, hideActions, colors, containerStyle, shortCodeStyle }: QRCodeDisplayProps) {
  const navigate = useNavigate();
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateQRDataURL(binId, size, colors).then(setDataUrl);
  }, [binId, size, colors?.dark, colors?.light]);

  async function handleCopy() {
    await navigator.clipboard.writeText(getBinUrl(binId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!dataUrl) return null;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="rounded-[var(--radius-lg)] bg-[var(--bg-print-surface)] p-3.5 border border-[var(--border-flat)] flex flex-col items-center" style={containerStyle}>
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
      {!hideActions && (
        <div className="flex gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy URL'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/print?ids=${binId}`)}
            className="gap-1.5"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      )}
    </div>
  );
}
