import { useState, useEffect } from 'react';
import { Copy, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateQRDataURL } from '@/lib/qr';
import { getBinUrl } from '@/lib/constants';

interface QRCodeDisplayProps {
  binId: string;
  size?: number;
}

export function QRCodeDisplay({ binId, size = 200 }: QRCodeDisplayProps) {
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

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-bin-${binId}.png`;
    a.click();
  }

  if (!dataUrl) return null;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="rounded-[var(--radius-lg)] bg-white p-3.5 shadow-sm">
        <img src={dataUrl} alt="QR Code" width={size} height={size} />
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
          onClick={handleDownload}
          className="rounded-[var(--radius-full)] gap-1.5"
        >
          <Download className="h-4 w-4" />
          Save
        </Button>
      </div>
    </div>
  );
}
