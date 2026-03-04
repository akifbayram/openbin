import { ChevronDown, ChevronLeft, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepIndicator } from '@/components/ui/stepper';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { ColorPicker } from '@/features/bins/ColorPicker';
import { IconPicker } from '@/features/bins/IconPicker';
import { ItemsInput } from '@/features/bins/ItemsInput';
import { TagInput } from '@/features/bins/TagInput';
import { addBin, notifyBinsChanged, useAllTags } from '@/features/bins/useBins';
import { BULK_ADD_STEPS } from '@/features/bulk-add/useBulkAdd';
import { compressImage } from '@/features/photos/compressImage';
import { addPhoto } from '@/features/photos/usePhotos';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import type { AiSuggestions } from '@/types';
import { AiSettingsSection } from './AiSettingsSection';
import { AiAnalyzeError, AiStreamingPreview } from './AiStreamingPreview';
import { parsePartialAnalysis } from './parsePartialAnalysis';
import { MAX_AI_PHOTOS } from './useAiAnalysis';
import { useAiSettings } from './useAiSettings';
import { useAiStream } from './useAiStream';

interface SingleBinReviewProps {
  files: File[];
  previewUrls: string[];
  sharedAreaId: string | null;
  onBack: () => void;
  onClose: () => void;
}

export function SingleBinReview({ files, previewUrls, sharedAreaId, onBack, onClose }: SingleBinReviewProps) {
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const { settings: aiSettings } = useAiSettings();
  const { aiEnabled, setAiEnabled } = useAiEnabled();
  const allTags = useAllTags();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [areaId, setAreaId] = useState<string | null>(sharedAreaId);
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');

  const {
    isStreaming: isAnalyzing,
    error: analyzeError,
    partialText,
    stream: streamAnalyze,
    cancel: cancelAnalyze,
  } = useAiStream<AiSuggestions>('/api/ai/analyze-image/stream', "Couldn't analyze — try again");
  const { name: streamedName, items: streamedItems } = parsePartialAnalysis(partialText);

  const [aiSetupExpanded, setAiSetupExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const steps = BULK_ADD_STEPS;
  const currentStepIndex = isAnalyzing ? 1 : isCreating ? 3 : 2;

  const autoAnalyzedRef = useRef(false);

  // Abort stream on unmount
  useEffect(() => cancelAnalyze, [cancelAnalyze]);

  const triggerAnalyze = useCallback(async () => {
    if (!aiSettings) {
      setAiSetupExpanded(true);
      return;
    }
    const compressed = await Promise.all(
      files.slice(0, MAX_AI_PHOTOS).map(async (f) => {
        const blob = await compressImage(f);
        return blob instanceof File
          ? blob
          : new File([blob], f.name, { type: blob.type || 'image/jpeg' });
      })
    );
    const formData = new FormData();
    if (compressed.length === 1) {
      formData.append('photo', compressed[0]);
    } else {
      for (const file of compressed) formData.append('photos', file);
    }
    if (activeLocationId) formData.append('locationId', activeLocationId);
    const result = await streamAnalyze(formData);
    if (result) {
      setName(result.name);
      setItems(result.items);
      setTags(result.tags);
      setNotes(result.notes);
    }
  }, [files, aiSettings, activeLocationId, streamAnalyze]);

  // Auto-analyze on mount
  useEffect(() => {
    if (aiEnabled && aiSettings && !autoAnalyzedRef.current) {
      autoAnalyzedRef.current = true;
      triggerAnalyze();
    }
  }, [aiEnabled, aiSettings, triggerAnalyze]);

  function handleBack() {
    cancelAnalyze();
    onBack();
  }

  async function handleCreate() {
    if (!name.trim() || !activeLocationId) return;
    setIsCreating(true);
    try {
      const createdBin = await addBin({
        name: name.trim(),
        locationId: activeLocationId,
        items,
        notes: notes.trim(),
        tags,
        areaId,
        icon: icon || undefined,
        color: color || undefined,
      });
      // Upload all photos fire-and-forget
      for (const file of files) {
        compressImage(file)
          .then((blob) => {
            const f =
              blob instanceof File
                ? blob
                : new File([blob], file.name, { type: blob.type || 'image/jpeg' });
            return addPhoto(createdBin.id, f);
          })
          .catch(() => {});
      }
      notifyBinsChanged();
      showToast({ message: `Created ${t.bin} with ${files.length} photo${files.length !== 1 ? 's' : ''}` });
      onClose();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : `Failed to create ${t.bin}` });
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <StepIndicator steps={steps} currentStepIndex={currentStepIndex} />

      {isAnalyzing ? (
        <AiStreamingPreview
          previewUrls={previewUrls}
          streamedName={streamedName}
          streamedItems={streamedItems}
          initialStatusLabel={`Analyzing ${Math.min(files.length, MAX_AI_PHOTOS)} photo${Math.min(files.length, MAX_AI_PHOTOS) !== 1 ? 's' : ''}...`}
        />
      ) : (
        <>
          {/* Photo preview (compact if reviewed) */}
          <div className="relative">
            {previewUrls.length === 1 ? (
              <img
                src={previewUrls[0]}
                alt="Upload 1"
                className={`w-full rounded-[var(--radius-lg)] object-cover bg-black/5 dark:bg-white/5 transition-all duration-500 ease-in-out ${
                  name ? 'max-h-20 opacity-80' : 'max-h-64'
                }`}
              />
            ) : (
              <div className="flex gap-2 overflow-x-auto">
                {previewUrls.map((url, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: preview URLs have no stable identity
                  <img key={i}
                    src={url}
                    alt={`Upload ${i + 1}`}
                    className={`shrink-0 flex-1 min-w-0 rounded-[var(--radius-lg)] object-cover bg-black/5 dark:bg-white/5 transition-all duration-500 ease-in-out ${
                      name ? 'max-h-20 opacity-80' : 'max-h-64'
                    }`}
                  />
                ))}
              </div>
            )}
            {aiEnabled && (
              <button
                type="button"
                onClick={triggerAnalyze}
                title="Rescan"
                className="absolute top-2 right-2 p-1.5 rounded-full bg-[var(--ai-accent)] text-white hover:bg-[var(--ai-accent-hover)] transition-colors"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            )}
          </div>

          {analyzeError && <AiAnalyzeError error={analyzeError} onRetry={triggerAnalyze} />}

          {/* Configure AI provider */}
          {aiEnabled && !aiSettings && (
            <div>
              <button
                type="button"
                onClick={() => setAiSetupExpanded(!aiSetupExpanded)}
                className="text-[12px] text-[var(--accent)] font-medium flex items-center gap-0.5"
              >
                Configure AI provider
                {aiSetupExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
          )}

          {/* Inline AI Setup */}
          {aiEnabled && aiSetupExpanded && !aiSettings && (
            <AiSettingsSection aiEnabled={aiEnabled} onToggle={setAiEnabled} />
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="single-bin-name">Name</Label>
              <Input
                id="single-bin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Holiday Decorations"
              />
            </div>

            <div className="space-y-2">
              <ItemsInput items={items} onChange={setItems} />
            </div>

            <div className="space-y-2">
              <Label>Area</Label>
              <AreaPicker
                locationId={activeLocationId ?? undefined}
                value={areaId}
                onChange={setAreaId}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="single-bin-notes">Notes</Label>
              <Textarea
                id="single-bin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`Notes about this ${t.bin}...`}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="rounded-[var(--radius-full)]"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || isAnalyzing || isCreating}
              className="rounded-[var(--radius-full)]"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create ${t.Bin}`
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
