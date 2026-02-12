import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Package, X, Ban, Camera, Sparkles, Loader2, ChevronRight, Eye, EyeOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { createLocation } from '@/features/locations/useLocations';
import { addBin } from '@/features/bins/useBins';
import { addPhoto } from '@/features/photos/usePhotos';
import { compressImage } from '@/features/photos/compressImage';
import { analyzeImageFile } from '@/features/ai/useAiAnalysis';
import { useAiSettings, saveAiSettings, testAiConnection } from '@/features/ai/useAiSettings';
import { COLOR_PALETTE } from '@/lib/colorPalette';
import type { AiProvider } from '@/types';

const STEPS = ['Location', 'Bin'] as const;
const AI_PROVIDERS: { key: AiProvider; label: string }[] = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'anthropic', label: 'Anthropic' },
  { key: 'openai-compatible', label: 'Compatible' },
];

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5-20250929',
  'openai-compatible': '',
};

export interface OnboardingActions {
  step: number;
  locationId?: string;
  advanceWithLocation: (id: string) => void;
  complete: () => void;
}

export function OnboardingOverlay({ step, locationId, advanceWithLocation, complete }: OnboardingActions) {
  const { setActiveLocationId } = useAuth();
  const { showToast } = useToast();
  const { settings: existingAiSettings, isLoading: aiSettingsLoading } = useAiSettings();

  // Step 0 state
  const [locationName, setLocationName] = useState('');
  // Step 1 state
  const [binName, setBinName] = useState('');
  const [binLocation, setBinLocation] = useState('');
  const [binColor, setBinColor] = useState('');
  const [binTags, setBinTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [binItems, setBinItems] = useState<string[]>([]);
  const [itemInput, setItemInput] = useState('');
  const itemInputRef = useRef<HTMLInputElement>(null);
  // Photo state
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // AI analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  // Inline AI settings state
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState(DEFAULT_MODELS.openai);
  const [aiEndpointUrl, setAiEndpointUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<'success' | 'error' | null>(null);
  // Loading
  const [loading, setLoading] = useState(false);
  // Success animation after first bin creation
  const [showSuccess, setShowSuccess] = useState(false);
  // Animation key to retrigger on step change
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [step]);

  // Track if AI settings already exist
  useEffect(() => {
    if (!aiSettingsLoading && existingAiSettings) {
      setAiConfigured(true);
    }
  }, [existingAiSettings, aiSettingsLoading]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Clean up photo preview URL
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAnalyzeError(null);
  }

  function handleRemovePhoto() {
    setPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setAnalyzeError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleAnalyzePhoto() {
    if (!photo) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const compressed = await compressImage(photo);
      const file = compressed instanceof File
        ? compressed
        : new File([compressed], photo.name, { type: compressed.type || 'image/jpeg' });
      const suggestions = await analyzeImageFile(file);
      if (suggestions.name) setBinName(suggestions.name);
      if (suggestions.items?.length) setBinItems(suggestions.items);
      if (suggestions.tags?.length) setBinTags(suggestions.tags.map(t => t.toLowerCase()));
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to analyze photo');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleTestAi() {
    if (!aiApiKey || !aiModel) return;
    setAiTesting(true);
    setAiTestResult(null);
    try {
      await testAiConnection({
        provider: aiProvider,
        apiKey: aiApiKey,
        model: aiModel,
        endpointUrl: aiProvider === 'openai-compatible' ? aiEndpointUrl : undefined,
      });
      setAiTestResult('success');
    } catch {
      setAiTestResult('error');
    } finally {
      setAiTesting(false);
    }
  }

  async function handleSaveAi() {
    if (!aiApiKey || !aiModel) return;
    setAiSaving(true);
    try {
      await saveAiSettings({
        provider: aiProvider,
        apiKey: aiApiKey,
        model: aiModel,
        endpointUrl: aiProvider === 'openai-compatible' ? aiEndpointUrl : undefined,
      });
      setAiConfigured(true);
      setAiExpanded(false);
      showToast({ message: 'AI settings saved' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to save AI settings' });
    } finally {
      setAiSaving(false);
    }
  }

  async function handleCreateLocation() {
    if (!locationName.trim()) return;
    setLoading(true);
    try {
      const loc = await createLocation(locationName.trim());
      setActiveLocationId(loc.id);
      advanceWithLocation(loc.id);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to create location' });
    } finally {
      setLoading(false);
    }
  }

  const dismissSuccess = useCallback(() => {
    setShowSuccess(false);
    complete();
  }, [complete]);

  async function handleCreateBin() {
    if (!binName.trim() || !locationId) return;
    setLoading(true);
    try {
      const binId = await addBin({
        name: binName.trim(),
        locationId,
        location: binLocation.trim() || undefined,
        color: binColor || undefined,
        tags: binTags.length > 0 ? binTags : undefined,
        items: binItems.length > 0 ? binItems : undefined,
      });

      // Upload photo if selected (non-blocking — bin already created)
      if (photo) {
        try {
          const compressed = await compressImage(photo);
          const file = compressed instanceof File
            ? compressed
            : new File([compressed], photo.name, { type: compressed.type || 'image/jpeg' });
          await addPhoto(binId, file);
        } catch {
          // Photo upload failure is non-blocking
        }
      }

      setShowSuccess(true);
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to create bin' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSkipSetup() {
    setLoading(true);
    try {
      // Only create a location if one wasn't already created in step 0
      if (!locationId) {
        const loc = await createLocation('My Location');
        setActiveLocationId(loc.id);
      }
      complete();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to skip setup' });
    } finally {
      setLoading(false);
    }
  }

  if (showSuccess) {
    return <BinSuccessOverlay onDismiss={dismissSuccess} />;
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
                Name your location
              </h2>
              <p className="text-[14px] text-[var(--text-tertiary)] mb-6 leading-relaxed">
                A location groups your bins — it could be your home, a garage, an office, or any space you want to organize.
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

          {step === 1 && (
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-[var(--accent)] bg-opacity-10 flex items-center justify-center mb-5">
                <Package className="h-8 w-8 text-[var(--accent)]" />
              </div>
              <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
                Create your first bin
              </h2>
              <p className="text-[14px] text-[var(--text-tertiary)] mb-6 leading-relaxed">
                A bin is any container you want to track — a box, drawer, shelf, etc.
              </p>
              <div className="w-full space-y-3 mb-4">
                {/* Photo upload area */}
                <div className="text-left">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    capture="environment"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  {!photo ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border-primary)] py-3 text-[14px] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      <Camera className="h-4 w-4" />
                      Add Photo
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2">
                      {photoPreview && (
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="h-16 w-16 rounded-[var(--radius-sm)] object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[var(--text-primary)] truncate">{photo.name}</p>
                        <p className="text-[12px] text-[var(--text-tertiary)]">{(photo.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {aiConfigured && (
                          <button
                            type="button"
                            onClick={handleAnalyzePhoto}
                            disabled={analyzing}
                            title="Analyze with AI"
                            className="p-1.5 rounded-full text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-50"
                          >
                            {analyzing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="p-1.5 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  {analyzeError && (
                    <p className="text-[12px] text-red-500 mt-1">{analyzeError}</p>
                  )}
                </div>

                <Input
                  value={binName}
                  onChange={(e) => setBinName(e.target.value)}
                  placeholder="Bin name"
                  autoFocus
                />
                <Input
                  value={binLocation}
                  onChange={(e) => setBinLocation(e.target.value)}
                  placeholder="Location (optional)"
                />

                {/* Items input */}
                <div className="text-left">
                  <label className="text-[13px] text-[var(--text-tertiary)] mb-1.5 block">Items</label>
                  <div className="flex flex-wrap gap-1.5 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2 focus-within:ring-2 focus-within:ring-[var(--accent)]">
                    {binItems.map((item, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 pl-1.5">
                        <button
                          type="button"
                          onClick={() => setBinItems(binItems.filter((_, j) => j !== i))}
                          className="mr-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                        {item}
                      </Badge>
                    ))}
                    <input
                      ref={itemInputRef}
                      value={itemInput}
                      onChange={(e) => setItemInput(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ',') && itemInput.trim()) {
                          e.preventDefault();
                          setBinItems([...binItems, itemInput.trim()]);
                          setItemInput('');
                        } else if (e.key === 'Backspace' && !itemInput && binItems.length > 0) {
                          setBinItems(binItems.slice(0, -1));
                        }
                      }}
                      placeholder={binItems.length === 0 ? 'Type and press Enter' : ''}
                      className="h-6 min-w-[80px] flex-1 bg-transparent p-0 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                    />
                  </div>
                </div>

                {/* Color picker */}
                <div className="text-left">
                  <label className="text-[13px] text-[var(--text-tertiary)] mb-1.5 block">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBinColor('')}
                      title="None"
                      className={cn(
                        'h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all',
                        !binColor
                          ? 'border-[var(--accent)] scale-110'
                          : 'border-[var(--text-tertiary)] opacity-50 hover:opacity-100 hover:scale-105'
                      )}
                    >
                      <Ban className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                    </button>
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setBinColor(c.key)}
                        title={c.label}
                        className={cn(
                          'h-7 w-7 rounded-full transition-all',
                          binColor === c.key
                            ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-elevated)] scale-110'
                            : 'hover:scale-105'
                        )}
                        style={{ backgroundColor: c.dot }}
                      />
                    ))}
                  </div>
                </div>

                {/* Tags input */}
                <div className="text-left">
                  <label className="text-[13px] text-[var(--text-tertiary)] mb-1.5 block">Tags</label>
                  <div className="flex flex-wrap gap-1.5 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2 focus-within:ring-2 focus-within:ring-[var(--accent)]">
                    {binTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 pl-1.5">
                        <button
                          type="button"
                          onClick={() => setBinTags(binTags.filter((t) => t !== tag))}
                          className="mr-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                        {tag}
                      </Badge>
                    ))}
                    <input
                      ref={tagInputRef}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                          e.preventDefault();
                          const t = tagInput.trim().toLowerCase();
                          if (!binTags.includes(t)) setBinTags([...binTags, t]);
                          setTagInput('');
                        } else if (e.key === 'Backspace' && !tagInput && binTags.length > 0) {
                          setBinTags(binTags.slice(0, -1));
                        }
                      }}
                      placeholder={binTags.length === 0 ? 'Type and press Enter' : ''}
                      className="h-6 min-w-[80px] flex-1 bg-transparent p-0 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                    />
                  </div>
                </div>

                {/* AI setup section */}
                {!aiSettingsLoading && (
                  <div className="text-left">
                    {aiConfigured ? (
                      <div className="flex items-center gap-1.5 text-[12px] text-[var(--accent)]">
                        <Check className="h-3.5 w-3.5" />
                        <span>AI configured</span>
                        {photo && (
                          <span className="text-[var(--text-tertiary)]">— tap <Sparkles className="h-3 w-3 inline" /> on photo to analyze</span>
                        )}
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setAiExpanded(!aiExpanded)}
                          className="flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', aiExpanded && 'rotate-90')} />
                          <Sparkles className="h-3.5 w-3.5" />
                          Set up AI Analysis
                        </button>
                        {aiExpanded && (
                          <div className="mt-2 space-y-2.5 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-3">
                            {/* Provider pills */}
                            <div className="flex gap-1.5">
                              {AI_PROVIDERS.map((p) => (
                                <button
                                  key={p.key}
                                  type="button"
                                  onClick={() => {
                                    setAiProvider(p.key);
                                    setAiModel(DEFAULT_MODELS[p.key]);
                                    setAiTestResult(null);
                                  }}
                                  className={cn(
                                    'px-2.5 py-1 rounded-full text-[12px] transition-colors',
                                    aiProvider === p.key
                                      ? 'bg-[var(--accent)] text-white'
                                      : 'bg-[var(--bg-active)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                  )}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                            {/* API key */}
                            <div className="relative">
                              <input
                                type={showApiKey ? 'text' : 'password'}
                                value={aiApiKey}
                                onChange={(e) => { setAiApiKey(e.target.value); setAiTestResult(null); }}
                                placeholder="API key"
                                className="w-full h-8 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-primary)] px-2.5 pr-8 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                              />
                              <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              >
                                {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            {/* Model */}
                            <input
                              type="text"
                              value={aiModel}
                              onChange={(e) => { setAiModel(e.target.value); setAiTestResult(null); }}
                              placeholder="Model name"
                              className="w-full h-8 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-primary)] px-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            />
                            {/* Endpoint URL (openai-compatible only) */}
                            {aiProvider === 'openai-compatible' && (
                              <input
                                type="text"
                                value={aiEndpointUrl}
                                onChange={(e) => setAiEndpointUrl(e.target.value)}
                                placeholder="Endpoint URL"
                                className="w-full h-8 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-primary)] px-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                              />
                            )}
                            {/* Test result */}
                            {aiTestResult && (
                              <p className={cn('text-[12px]', aiTestResult === 'success' ? 'text-green-500' : 'text-red-500')}>
                                {aiTestResult === 'success' ? 'Connection successful' : 'Connection failed — check settings'}
                              </p>
                            )}
                            {/* Test + Save buttons */}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleTestAi}
                                disabled={!aiApiKey || !aiModel || aiTesting}
                                className="flex-1 h-7 rounded-[var(--radius-sm)] bg-[var(--bg-active)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors"
                              >
                                {aiTesting ? 'Testing...' : 'Test'}
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveAi}
                                disabled={!aiApiKey || !aiModel || aiSaving}
                                className="flex-1 h-7 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[12px] text-white disabled:opacity-40 transition-colors"
                              >
                                {aiSaving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <Button
                type="button"
                onClick={handleCreateBin}
                disabled={!binName.trim() || loading}
                className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
              >
                {loading ? 'Creating...' : 'Create Bin'}
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function BinSuccessOverlay({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2800);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[var(--overlay-backdrop)] backdrop-blur-md scan-success-enter"
      onClick={onDismiss}
    >
      {/* Expanding rings */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-24 w-24 rounded-full border-2 border-[var(--accent)] scan-ring scan-ring-1" />
        <div className="absolute h-24 w-24 rounded-full border-2 border-[var(--accent)] scan-ring scan-ring-2" />
        <div className="absolute h-24 w-24 rounded-full border-2 border-[var(--accent)] scan-ring scan-ring-3" />

        {/* Checkmark circle */}
        <div className="relative h-24 w-24 rounded-full bg-[var(--accent)] flex items-center justify-center scan-check-scale">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-12 w-12 scan-check-draw"
          >
            <polyline points="4 12 10 18 20 6" />
          </svg>
        </div>
      </div>

      {/* Text */}
      <p className="mt-8 text-[22px] font-bold text-[var(--text-primary)] scan-text-fade">
        First bin created!
      </p>
      <p className="mt-2 text-[14px] text-[var(--text-tertiary)] scan-text-fade-delay">
        You're all set
      </p>
    </div>
  );
}
