import { Button } from '@/components/ui/button';
import { BinPreviewCard } from '@/features/bins/BinPreviewCard';
import { QRCodeDisplay } from '@/features/qrcode/QRCodeDisplay';
import { DEMO_BIN } from '../onboardingConstants';

export function DemoBrowseStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
        Everything in its place
      </h2>
      <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
        Items, tags, area, notes, and a QR code.
      </p>
      <BinPreviewCard
        name={DEMO_BIN.name}
        color={DEMO_BIN.color}
        icon={DEMO_BIN.icon}
        items={[...DEMO_BIN.items]}
        tags={[...DEMO_BIN.tags]}
        areaName={DEMO_BIN.areaName}
        className="mb-4"
      />
      <div className="rounded-[var(--radius-lg)] p-3 flex flex-col items-center mb-5">
        <QRCodeDisplay binId={DEMO_BIN.shortCode} size={120} shortCode={DEMO_BIN.shortCode} hideActions />
      </div>
      <Button
        type="button"
        onClick={onNext}
        className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
      >
        Next
      </Button>
    </div>
  );
}
