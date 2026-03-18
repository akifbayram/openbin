import { Plus, X } from 'lucide-react';
import { BrandIcon } from '@/components/BrandIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface WelcomeStepProps {
  locationName: string;
  setLocationName: (v: string) => void;
  areaNames: string[];
  areaInput: string;
  setAreaInput: (v: string) => void;
  showAreaInput: boolean;
  setShowAreaInput: (v: boolean) => void;
  handleAddArea: () => void;
  handleRemoveArea: (name: string) => void;
  handleCreateLocation: () => void;
  loading: boolean;
  t: { location: string; bins: string; areas: string; Areas: string };
}

export function WelcomeStep({
  locationName, setLocationName,
  areaNames, areaInput, setAreaInput,
  showAreaInput, setShowAreaInput,
  handleAddArea, handleRemoveArea, handleCreateLocation,
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

      {/* Areas section */}
      {!showAreaInput ? (
        <button
          type="button"
          onClick={() => setShowAreaInput(true)}
          className="text-[13px] text-[var(--accent)] hover:opacity-80 transition-opacity mb-4"
        >
          + Add {t.areas} (optional)
        </button>
      ) : (
        <div className="w-full text-left mb-4 space-y-2">
          <label htmlFor="onboarding-area-input" className="text-[13px] text-[var(--text-tertiary)] block">
            {t.Areas} <span className="text-[var(--text-tertiary)] opacity-60">(optional)</span>
          </label>
          <div className="flex gap-2">
            <Input
              id="onboarding-area-input"
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value.slice(0, 50))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddArea(); } }}
              placeholder={`e.g., Garage, Kitchen`}
              maxLength={50}
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddArea}
              disabled={!areaInput.trim()}
              className="h-10 px-3"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {areaNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {areaNames.map((name) => (
                <Badge key={name} variant="secondary" className="text-[12px] gap-1 pr-1">
                  {name}
                  <button
                    type="button"
                    onClick={() => handleRemoveArea(name)}
                    className="hover:text-[var(--destructive)] transition-colors ml-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

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
