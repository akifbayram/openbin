import { Check, Copy, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getBinUrl } from '@/lib/constants';
import { generateQRDataURL } from '@/lib/qr';

interface QRCodeDisplayProps {
  binId: string;
  size?: number;
  /** Show short code text below the QR image, sized to fill the QR width. */
  shortCode?: string;
}

export function QRCodeDisplay({ binId, size = 200, shortCode }: QRCodeDisplayProps) {
  const navigate = useNavigate();
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateQRDataURL(binId, size).then(setDataUrl);
  }, [binId, size]);

  async function handleCopy() {
    await navigator.clipboard.writeText(getBinUrl(binId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!dataUrl) return null;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="rounded-[var(--radius-lg)] bg-white p-3.5 shadow-sm flex flex-col items-center">
        <img src={dataUrl} alt="QR Code" width={size} height={size} />
        {shortCode && (
          <p
            className="font-mono font-bold tracking-wider text-gray-400 text-center"
            style={{ fontSize: `${size / (shortCode.length * 0.6 + (shortCode.length - 1) * 0.2)}px` }}
          >
            {shortCode}
          </p>
        )}
      </div>
      <div className="flex gap-2.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          className="rounded-[var(--radius-full)] gap-1.5"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy URL'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/print?ids=${binId}`)}
          className="rounded-[var(--radius-full)] gap-1.5"
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>
    </div>
  );
}
