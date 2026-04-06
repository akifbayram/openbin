import { Folder, Plus, X } from 'lucide-react';
import { BrandIcon } from '@/components/BrandIcon';
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
  t: { location: string; bins: string; areas: string; Area: string; Areas: string };
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
      <div className="w-full text-left mb-4 space-y-2">
        <h3 className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
          {t.Areas} <span className="normal-case tracking-normal font-normal opacity-60">(optional)</span>
        </h3>
        <div className="flex flex-col gap-2">
          {areaNames.map((name) => (
            <div key={name} className="flat-card rounded-[var(--radius-lg)] p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                <Folder className="h-4.5 w-4.5 text-[var(--accent)]" />
              </div>
              <span className="text-[15px] font-semibold text-[var(--text-primary)] flex-1 min-w-0 truncate">
                {name}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveArea(name)}
                className="h-7 w-7 rounded-[var(--radius-xs)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--destructive)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
                aria-label={`Remove ${name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {showAreaInput ? (
            <div className="rounded-[var(--radius-lg)] p-4 border border-dashed border-[var(--border-flat)] flex gap-2">
              <Input
                id="onboarding-area-input"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value.slice(0, 50))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddArea(); } }}
                placeholder={`e.g., Garage, Kitchen`}
                maxLength={50}
                autoFocus
                className="flex-1 h-9 text-[14px]"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddArea}
                disabled={!areaInput.trim()}
                className="h-9 px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAreaInput(true)}
              className="rounded-[var(--radius-lg)] p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors duration-150 active:bg-[var(--bg-active)] border border-dashed border-[var(--border-flat)] bg-transparent flex items-center gap-3 text-[var(--text-tertiary)]"
            >
              <div className="h-9 w-9 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-flat)] flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-[13px] font-medium">{`Add ${t.Area}`}</span>
            </button>
          )}
        </div>
      </div>

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
