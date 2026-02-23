import './animations.css';
import { useState, useEffect } from 'react';
import { MapPin, X, Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { createLocation } from '@/features/locations/useLocations';
import { createArea } from '@/features/areas/useAreas';
import { addBin } from '@/features/bins/useBins';
import { addPhoto } from '@/features/photos/usePhotos';
import { compressImage } from '@/features/photos/compressImage';
import { useTerminology } from '@/lib/terminology';
import { BinPreviewCard } from '@/features/bins/BinPreviewCard';
import { BinCreateForm } from '@/features/bins/BinCreateForm';
import type { BinCreateFormData } from '@/features/bins/BinCreateForm';
import { QRCodeDisplay } from '@/features/qrcode/QRCodeDisplay';
import { ONBOARDING_TOTAL_STEPS } from './useOnboarding';
import type { Bin } from '@/types';

const STEPS = Array.from({ length: ONBOARDING_TOTAL_STEPS });

export interface OnboardingActions {
  step: number;
  locationId?: string;
  advanceWithLocation: (id: string) => void;
  advanceStep: () => void;
  complete: () => void;
}

export function OnboardingOverlay({ step, locationId, advanceWithLocation, advanceStep, complete }: OnboardingActions) {
  const t = useTerminology();
  const { setActiveLocationId } = useAuth();
  const { showToast } = useToast();

  // Step 0 state
  const [locationName, setLocationName] = useState('');
  const [areaNames, setAreaNames] = useState<string[]>([]);
  const [areaInput, setAreaInput] = useState('');
  const [showAreaInput, setShowAreaInput] = useState(false);
  // Loading
  const [loading, setLoading] = useState(false);
  // Created bin for QR preview
  const [createdBin, setCreatedBin] = useState<Bin | null>(null);
  // Animation key to retrigger on step change
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [step]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // If we reach QR step without a created bin (e.g. page refresh), auto-advance
  useEffect(() => {
    if (step === 2 && !createdBin) {
      advanceStep();
    }
  }, [step, createdBin, advanceStep]);

  function handleAddArea() {
    const name = areaInput.trim();
    if (!name || areaNames.includes(name)) return;
    setAreaNames((prev) => [...prev, name]);
    setAreaInput('');
  }

  function handleRemoveArea(name: string) {
    setAreaNames((prev) => prev.filter((a) => a !== name));
  }

  async function handleCreateLocation() {
    if (!locationName.trim()) return;
    setLoading(true);
    try {
      const loc = await createLocation(locationName.trim());
      setActiveLocationId(loc.id);
      // Create areas (best-effort)
      for (const name of areaNames) {
        try {
          await createArea(loc.id, name);
        } catch {
          // Skip failures
        }
      }
      advanceWithLocation(loc.id);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : `Failed to create ${t.location}` });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBin(data: BinCreateFormData) {
    if (!locationId) return;
    setLoading(true);
    try {
      const bin = await addBin({
        name: data.name,
        locationId,
        color: data.color || undefined,
        tags: data.tags.length > 0 ? data.tags : undefined,
        items: data.items.length > 0 ? data.items : undefined,
        icon: data.icon || undefined,
        cardStyle: data.cardStyle || undefined,
        areaId: data.areaId,
      });

      setCreatedBin(bin);

      // Upload photos if selected (non-blocking — bin already created)
      for (const p of data.photos) {
        try {
          const compressed = await compressImage(p);
          const file = compressed instanceof File
            ? compressed
            : new File([compressed], p.name, { type: compressed.type || 'image/jpeg' });
          await addPhoto(bin.id, file);
        } catch {
          // Photo upload failure is non-blocking
        }
      }

      advanceStep();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : `Failed to create ${t.bin}` });
    } finally {
      setLoading(false);
    }
  }

  async function handleSkipSetup() {
    setLoading(true);
    try {
      // Only create a location if one wasn't already created in step 0
      if (!locationId) {
        const loc = await createLocation(`My ${t.Location}`);
        setActiveLocationId(loc.id);
      }
      complete();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to skip setup' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-backdrop)] backdrop-blur-sm">
      <div className="glass-heavy rounded-[var(--radius-xl)] w-full max-w-sm mx-5 px-8 py-8 relative max-h-[85vh] overflow-y-auto">
        {/* Close button */}
        <button
          type="button"
          onClick={handleSkipSetup}
          disabled={loading}
          aria-label="Close setup"
          className="absolute top-4 right-4 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40 p-1 z-10"
        >
          <X className="h-5 w-5" />
        </button>
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-2 w-2 rounded-full transition-all duration-300',
                i === step
                  ? 'bg-[var(--accent)] scale-125'
                  : i < step
                    ? 'bg-[var(--accent)] opacity-40'
                    : 'bg-[var(--bg-active)]'
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div key={animKey} className="onboarding-step-enter">
          {/* Step 0: Location + Areas */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-[var(--accent)] bg-opacity-10 flex items-center justify-center mb-5">
                <MapPin className="h-8 w-8 text-[var(--accent)]" />
              </div>
              <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
                Name your {t.location}
              </h2>
              <p className="text-[14px] text-[var(--text-tertiary)] mb-6 leading-relaxed">
                A {t.location} groups your {t.bins} — it could be your home, a garage, an office, or any space you want to organize.
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
                  <label className="text-[13px] text-[var(--text-tertiary)] block">
                    {t.Areas} <span className="text-[var(--text-tertiary)] opacity-60">(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
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
          )}

          {/* Step 1: Bin + Appearance */}
          {step === 1 && locationId && (
            <div className="flex flex-col items-center text-center">
              <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
                Create your first {t.bin}
              </h2>
              <p className="text-[14px] text-[var(--text-tertiary)] mb-6 leading-relaxed">
                A {t.bin} is any container you want to track — a box, drawer, shelf, etc.
              </p>
              <BinCreateForm
                mode="onboarding"
                locationId={locationId}
                onSubmit={handleCreateBin}
                submitting={loading}
                header={(state) => (
                  <BinPreviewCard
                    name={state.name}
                    color={state.color}
                    items={state.items}
                    tags={state.tags}
                    icon={state.icon}
                    cardStyle={state.cardStyle}
                    areaName={state.areaName}
                  />
                )}
                className="w-full"
              />
            </div>
          )}

          {/* Step 2: QR Preview */}
          {step === 2 && createdBin && (
            <div className="flex flex-col items-center text-center">
              <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
                Your first QR label
              </h2>
              <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
                Print this label and stick it on your {t.bin}. Anyone can scan it to see what's inside.
              </p>
              <QRCodeDisplay binId={createdBin.id} size={160} />
              <div className="mt-4 space-y-1">
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {createdBin.name}
                </p>
                <p className="text-[13px] font-mono tracking-wider text-[var(--text-tertiary)]">
                  {createdBin.short_code}
                </p>
                {createdBin.area_name && (
                  <p className="text-[13px] text-[var(--text-tertiary)]">
                    {createdBin.area_name}
                  </p>
                )}
              </div>
              <Button
                type="button"
                onClick={advanceStep}
                className="w-full rounded-[var(--radius-md)] h-11 text-[15px] mt-6"
              >
                Next
              </Button>
            </div>
          )}

          {/* Step 3: Get Started */}
          {step === 3 && (
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-[var(--accent)] bg-opacity-10 flex items-center justify-center mb-5">
                <Sparkles className="h-8 w-8 text-[var(--accent)]" />
              </div>
              <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
                You're all set!
              </h2>
              <p className="text-[14px] text-[var(--text-tertiary)] mb-6 leading-relaxed">
                Create more {t.bins}, organize by {t.area}, add tags, and scan QR labels to find anything instantly.
              </p>
              <Button
                type="button"
                onClick={advanceStep}
                className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
              >
                Get Started
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
