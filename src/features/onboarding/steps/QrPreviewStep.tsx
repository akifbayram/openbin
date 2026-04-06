import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCodeDisplay } from '@/features/qrcode/QRCodeDisplay';
import type { Bin } from '@/types';

export interface QrPreviewStepProps {
  createdBin: Bin;
  onPrint: () => void;
  onNext: () => void;
  t: { bin: string };
}

export function QrPreviewStep({ createdBin, onPrint, onNext, t }: QrPreviewStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
        Scan to find anything
      </h2>
      <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
        Print this label and stick it on your {t.bin}. Scan with any phone camera to instantly see what's inside.
      </p>
      <QRCodeDisplay binId={createdBin.id} size={160} shortCode={createdBin.short_code} hideActions />
      <div className="flex gap-3 w-full mt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onPrint}
          className="flex-1 rounded-[var(--radius-md)] h-11 text-[15px] gap-1.5"
        >
          <Printer className="h-4 w-4" />
          Print Label
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-[var(--radius-md)] h-11 text-[15px]"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
