import { useState, useEffect } from 'react';
import { batchGenerateQRDataURLs } from '@/lib/qr';
import type { Bin } from '@/types';
import { LabelCell } from './LabelCell';

interface LabelSheetProps {
  bins: Bin[];
}

export function LabelSheet({ bins }: LabelSheetProps) {
  const [qrMap, setQrMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bins.length === 0) {
      setQrMap(new Map());
      return;
    }

    let cancelled = false;
    setLoading(true);

    const binIds = bins.map((b) => b.id);
    batchGenerateQRDataURLs(binIds, 150).then((result) => {
      if (!cancelled) {
        setQrMap(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bins]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)] text-[13px]">
        Generating labels…
      </div>
    );
  }

  return (
    <div className="label-sheet">
      {bins.map((bin) => (
        <LabelCell key={bin.id} bin={bin} qrDataUrl={qrMap.get(bin.id) ?? ''} />
      ))}
    </div>
  );
}
