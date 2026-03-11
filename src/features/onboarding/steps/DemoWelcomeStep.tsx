import { BrandIcon } from '@/components/BrandIcon';
import { Button } from '@/components/ui/button';

export function DemoWelcomeStep({ activeLocationId, onAdvance }: { activeLocationId: string; onAdvance: (id: string) => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="h-16 w-16 rounded-full flex items-center justify-center mb-5 bg-[var(--accent)]/10">
        <BrandIcon className="h-8 w-8 text-[var(--accent)]" />
      </div>
      <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
        Welcome to OpenBin
      </h2>
      <p className="text-[14px] text-[var(--text-tertiary)] mb-6 leading-relaxed">
        We've set up a family home with 40+ organized bins — tools, kids' stuff, camping gear, and more. Let's take a quick tour.
      </p>
      <Button
        type="button"
        onClick={() => onAdvance(activeLocationId)}
        className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
      >
        Get Started
      </Button>
    </div>
  );
}
