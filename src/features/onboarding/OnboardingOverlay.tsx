import './animations.css';
import { useState, useEffect, useCallback } from 'react';
import { MapPin, X } from 'lucide-react';
import { ScanSuccessOverlay } from './ScanSuccessOverlay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { createLocation } from '@/features/locations/useLocations';
import { addBin } from '@/features/bins/useBins';
import { addPhoto } from '@/features/photos/usePhotos';
import { compressImage } from '@/features/photos/compressImage';
import { useTerminology } from '@/lib/terminology';
import { BinPreviewCard } from '@/features/bins/BinPreviewCard';
import { BinCreateForm } from '@/features/bins/BinCreateForm';
import type { BinCreateFormData } from '@/features/bins/BinCreateForm';

const STEPS = ['location', 'bin'] as const;

export interface OnboardingActions {
  step: number;
  locationId?: string;
  advanceWithLocation: (id: string) => void;
  complete: () => void;
}

export function OnboardingOverlay({ step, locationId, advanceWithLocation, complete }: OnboardingActions) {
  const t = useTerminology();
  const { setActiveLocationId } = useAuth();
  const { showToast } = useToast();

  // Step 0 state
  const [locationName, setLocationName] = useState('');
  // Loading
  const [loading, setLoading] = useState(false);
  // Success animation after first bin creation
  const [showSuccess, setShowSuccess] = useState(false);
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

  async function handleCreateLocation() {
    if (!locationName.trim()) return;
    setLoading(true);
    try {
      const loc = await createLocation(locationName.trim());
      setActiveLocationId(loc.id);
      advanceWithLocation(loc.id);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : `Failed to create ${t.location}` });
    } finally {
      setLoading(false);
    }
  }

  const dismissSuccess = useCallback(() => {
    setShowSuccess(false);
    complete();
  }, [complete]);

  async function handleCreateBin(data: BinCreateFormData) {
    if (!locationId) return;
    setLoading(true);
    try {
      const binId = await addBin({
        name: data.name,
        locationId,
        color: data.color || undefined,
        tags: data.tags.length > 0 ? data.tags : undefined,
        items: data.items.length > 0 ? data.items : undefined,
      });

      // Upload photos if selected (non-blocking — bin already created)
      for (const p of data.photos) {
        try {
          const compressed = await compressImage(p);
          const file = compressed instanceof File
            ? compressed
            : new File([compressed], p.name, { type: compressed.type || 'image/jpeg' });
          await addPhoto(binId, file);
        } catch {
          // Photo upload failure is non-blocking
        }
      }

      setShowSuccess(true);
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

  const { bin: binLabel } = useTerminology();
  if (showSuccess) {
    return <ScanSuccessOverlay onDismiss={dismissSuccess} title={`First ${binLabel} created!`} />;
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
                  />
                )}
                className="w-full"
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
