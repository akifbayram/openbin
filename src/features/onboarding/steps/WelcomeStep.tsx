import { BrandIcon } from '@/components/BrandIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface WelcomeStepProps {
  locationName: string;
  setLocationName: (v: string) => void;
  handleCreateLocation: () => void;
  loading: boolean;
  t: { location: string; bins: string };
}

export function WelcomeStep({
  locationName, setLocationName,
  handleCreateLocation,
  loading, t,
}: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="h-16 w-16 rounded-[var(--radius-xl)] flex items-center justify-center mb-5 bg-[var(--accent)]/10">
        <BrandIcon className="h-8 w-8 text-[var(--accent)]" />
      </div>
      <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
        Welcome to OpenBin
      </h2>
      <p className="text-[14px] text-[var(--text-tertiary)] mb-6 leading-relaxed">
        Start by naming your first {t.location} — a space where your {t.bins} live, like your home, garage, or office.
      </p>
      <Input
        value={locationName}
        onChange={(e) => setLocationName(e.target.value.slice(0, 50))}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateLocation(); }}
        placeholder="e.g., My House"
        maxLength={50}
        autoFocus
        className="mb-4 text-center"
      />

      <Button
        type="button"
        onClick={handleCreateLocation}
        disabled={!locationName.trim() || loading}
        className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
      >
        {loading ? 'Creating...' : 'Continue'}
      </Button>
    </div>
  );
}
