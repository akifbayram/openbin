import './animations.css';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, X, Sparkles, Plus, Printer, Camera, MessageSquare, Search, ListChecks, PackagePlus, QrCode, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { createLocation } from '@/features/locations/useLocations';
import { createArea } from '@/features/areas/useAreas';
import { addBin } from '@/features/bins/useBins';
import { useTerminology } from '@/lib/terminology';
import { BinPreviewCard } from '@/features/bins/BinPreviewCard';
import { ItemsInput } from '@/features/bins/ItemsInput';
import { QRCodeDisplay } from '@/features/qrcode/QRCodeDisplay';
import { ONBOARDING_TOTAL_STEPS } from './useOnboarding';
import type { Bin } from '@/types';

const STEPS = Array.from({ length: ONBOARDING_TOTAL_STEPS });
const BRAND = '#5e2fe0';

export interface OnboardingActions {
  step: number;
  locationId?: string;
  advanceWithLocation: (id: string) => void;
  advanceStep: () => void;
  complete: () => void;
}

const AI_FEATURES = [
  { icon: Camera, title: 'Photo Analysis', desc: 'Snap a photo, AI catalogs everything inside' },
  { icon: MessageSquare, title: 'Natural Language', desc: "'Add screwdriver to the tools bin'" },
  { icon: Search, title: 'Inventory Search', desc: "'Where is the glass cleaner?'" },
  { icon: ListChecks, title: 'Smart Lists', desc: 'Dictate items, AI extracts a clean list' },
] as const;

export function OnboardingOverlay({ step, locationId, advanceWithLocation, advanceStep, complete }: OnboardingActions) {
  const t = useTerminology();
  const navigate = useNavigate();
  const { setActiveLocationId } = useAuth();
  const { showToast } = useToast();

  // Step 0 state
  const [locationName, setLocationName] = useState('');
  const [areaNames, setAreaNames] = useState<string[]>([]);
  const [areaInput, setAreaInput] = useState('');
  const [showAreaInput, setShowAreaInput] = useState(false);
  // Step 1 state
  const [binName, setBinName] = useState('');
  const [binItems, setBinItems] = useState<string[]>([]);
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
      // Advance step BEFORE setting active location — createLocation fires
      // notifyLocationsChanged() which refetches the location list. If locations.length
      // becomes > 0 while step is still 0, the overlay's mount condition briefly fails
      // and causes a white flash.
      advanceWithLocation(loc.id);
      setActiveLocationId(loc.id);
      // Create areas (best-effort)
      for (const name of areaNames) {
        try {
          await createArea(loc.id, name);
        } catch {
          // Skip failures
        }
      }
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : `Failed to create ${t.location}` });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBin() {
    if (!locationId || !binName.trim()) return;
    setLoading(true);
    try {
      const bin = await addBin({
        name: binName.trim(),
        locationId,
        items: binItems.length > 0 ? binItems : undefined,
      });
      setCreatedBin(bin);
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
                  ? 'scale-125'
                  : i < step
                    ? 'opacity-40'
                    : 'bg-[var(--bg-active)]'
              )}
              style={i <= step ? { backgroundColor: BRAND } : undefined}
            />
          ))}
        </div>

        {/* Step content */}
        <div key={animKey} className="onboarding-step-enter">
          {/* Step 0: Welcome + Location + Areas */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: `${BRAND}18` }}>
                <MapPin className="h-8 w-8" style={{ color: BRAND }} />
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

          {/* Step 1: Create First Bin (simplified) */}
          {step === 1 && locationId && (
            <div className="flex flex-col items-center text-center">
              <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
                Create your first {t.bin}
              </h2>
              <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
                A {t.bin} is any container you want to track — a box, drawer, shelf, etc.
              </p>
              <BinPreviewCard
                name={binName || `My ${t.Bin}`}
                color=""
                items={binItems}
                tags={[]}
                className="mb-5"
              />
              <div className="w-full space-y-3 text-left">
                <Input
                  value={binName}
                  onChange={(e) => setBinName(e.target.value.slice(0, 100))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && binName.trim()) handleCreateBin(); }}
                  placeholder={`${t.Bin} name`}
                  maxLength={100}
                  autoFocus
                />
                <ItemsInput
                  items={binItems}
                  onChange={setBinItems}
                  showAi={false}
                />
              </div>
              <Button
                type="button"
                onClick={handleCreateBin}
                disabled={!binName.trim() || loading}
                className="w-full rounded-[var(--radius-md)] h-11 text-[15px] mt-5"
              >
                {loading ? 'Creating...' : `Create ${t.Bin}`}
              </Button>
            </div>
          )}

          {/* Step 2: QR Preview */}
          {step === 2 && createdBin && (
            <div className="flex flex-col items-center text-center">
              <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
                Scan to find anything
              </h2>
              <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
                Print this label and stick it on your {t.bin}. Scan with any phone camera to instantly see what's inside.
              </p>
              <QRCodeDisplay binId={createdBin.id} size={160} shortCode={createdBin.id} />
              <div className="flex gap-3 w-full mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { complete(); navigate('/print'); }}
                  className="flex-1 rounded-[var(--radius-md)] h-11 text-[15px] gap-1.5"
                >
                  <Printer className="h-4 w-4" />
                  Print Label
                </Button>
                <Button
                  type="button"
                  onClick={advanceStep}
                  className="flex-1 rounded-[var(--radius-md)] h-11 text-[15px]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: AI Feature Showcase */}
          {step === 3 && (
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: `${BRAND}18` }}>
                <Sparkles className="h-8 w-8" style={{ color: BRAND }} />
              </div>
              <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
                Supercharge with AI
              </h2>
              <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
                Bring your own API key from OpenAI, Anthropic, Google, or any compatible provider.
              </p>
              <div className="w-full space-y-2 mb-6">
                {AI_FEATURES.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="onboarding-feature-card flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 bg-[var(--bg-active)] text-left">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND}18` }}>
                      <Icon className="h-4 w-4" style={{ color: BRAND }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</div>
                      <div className="text-[12px] text-[var(--text-tertiary)] leading-snug">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                onClick={() => { complete(); navigate('/settings#ai-settings'); }}
                className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
              >
                Set Up Now
              </Button>
              <button
                type="button"
                onClick={advanceStep}
                className="mt-3 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                Maybe Later
              </button>
            </div>
          )}

          {/* Step 4: Completion with Next Steps */}
          {step === 4 && (
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: `${BRAND}18` }}>
                <Sparkles className="h-8 w-8" style={{ color: BRAND }} />
              </div>
              <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
                You're ready to go
              </h2>
              <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
                Here are a few things you can do next.
              </p>
              <div className="w-full space-y-2 mb-6">
                {([
                  { icon: PackagePlus, label: 'Create more bins', path: '/bins' },
                  { icon: QrCode, label: 'Scan a QR code', path: '/scan' },
                  { icon: Settings, label: 'Explore settings', path: '/settings' },
                ] as const).map(({ icon: Icon, label, path }) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => { complete(); navigate(path); }}
                    className="w-full flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 bg-[var(--bg-active)] hover:bg-[var(--bg-hover)] transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND}18` }}>
                      <Icon className="h-4 w-4" style={{ color: BRAND }} />
                    </div>
                    <span className="text-[14px] font-medium text-[var(--text-primary)]">{label}</span>
                  </button>
                ))}
              </div>
              <Button
                type="button"
                onClick={() => { complete(); navigate('/'); }}
                className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
              >
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
