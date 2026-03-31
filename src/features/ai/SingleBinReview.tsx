import { ArrowUp, ChevronDown, ChevronLeft, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepIndicator } from '@/components/ui/stepper';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { AreaPicker } from '@/features/areas/AreaPicker';
import type { CreatedBinInfo } from '@/features/bins/BinCreateSuccess';
import { BinCreateSuccess } from '@/features/bins/BinCreateSuccess';
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
import { buildQuantityMap, mergeItemQuantities } from '@/lib/itemQuantities';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
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
  onRestart: () => void;
}

export function SingleBinReview({ files, previewUrls, sharedAreaId, onBack, onClose, onRestart }: SingleBinReviewProps) {
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const { settings: aiSettings } = useAiSettings();
  const { aiEnabled, setAiEnabled } = useAiEnabled();
  const allTags = useAllTags();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [areaId, setAreaId] = useState<string | null>(sharedAreaId);
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [successBin, setSuccessBin] = useState<CreatedBinInfo | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [correctionCount, setCorrectionCount] = useState(0);
  const MAX_CORRECTIONS = 3;

  const {
    isStreaming: isAnalyzing,
    error: analyzeError,
    partialText: analyzePartial,
    stream: streamAnalyze,
    cancel: cancelAnalyze,
  } = useAiStream<AiSuggestions>('/api/ai/analyze-image/stream', "Couldn't analyze — try again");

  const {
    isStreaming: isCorrecting,
    partialText: correctPartial,
    stream: streamCorrection,
    cancel: cancelCorrection,
  } = useAiStream<AiSuggestions>('/api/ai/correct/stream', "Couldn't correct — try again");

  const {
    isStreaming: isReanalyzing,
    partialText: reanalyzePartial,
    stream: streamReanalyze,
    cancel: cancelReanalyze,
  } = useAiStream<AiSuggestions>('/api/ai/reanalyze-image/stream', "Couldn't reanalyze — try again");

  // Parse partial streaming text to show progressive name/items
  const activePartial = isAnalyzing ? analyzePartial : isCorrecting ? correctPartial : isReanalyzing ? reanalyzePartial : '';
  const parsedPartial = useMemo(() => activePartial ? parsePartialAnalysis(activePartial) : null, [activePartial]);

  const [aiSetupExpanded, setAiSetupExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const steps = BULK_ADD_STEPS;
  const currentStepIndex = (isAnalyzing || isCorrecting || isReanalyzing) ? 1 : isCreating ? 3 : 2;

  const autoAnalyzedRef = useRef(false);

  // Abort streams on unmount
  useEffect(() => {
    return () => { cancelAnalyze(); cancelCorrection(); cancelReanalyze(); };
  }, [cancelAnalyze, cancelCorrection, cancelReanalyze]);

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
      setItems(result.items.map((i) => i.name));
      setItemQuantities(buildQuantityMap(result.items));
      setTags(result.tags);
      setNotes(result.notes);
    }
  }, [files, aiSettings, activeLocationId, streamAnalyze]);

  const triggerReanalyze = useCallback(async () => {
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

    const previousResult = {
      name,
      items: items.map((itemName) => ({ name: itemName })),
      tags,
      notes,
    };

    const formData = new FormData();
    if (compressed.length === 1) {
      formData.append('photo', compressed[0]);
    } else {
      for (const file of compressed) formData.append('photos', file);
    }
    formData.append('previousResult', JSON.stringify(previousResult));
    if (activeLocationId) formData.append('locationId', activeLocationId);

    const result = await streamReanalyze(formData);
    if (result) {
      setName(result.name);
      setItems(result.items.map((i) => i.name));
      setItemQuantities(buildQuantityMap(result.items));
      setTags(result.tags);
      setNotes(result.notes);
    }
  }, [files, aiSettings, activeLocationId, streamReanalyze, name, items, tags, notes]);

  const triggerCorrection = useCallback(async (text: string) => {
    const previousResult = { name, items, tags, notes };
    const result = await streamCorrection({
      previousResult,
      correction: text,
      locationId: activeLocationId || undefined,
    });
    if (result) {
      setName(result.name);
      setItems(result.items.map((i) => i.name));
      setItemQuantities(buildQuantityMap(result.items));
      setTags(result.tags);
      setNotes(result.notes);
      setCorrectionCount((c) => c + 1);
      setCorrectionText('');
      setCorrectionOpen(false);
    }
  }, [name, items, tags, notes, activeLocationId, streamCorrection]);

  function handleCorrectionSubmit() {
    const trimmed = correctionText.trim();
    if (!trimmed) {
      cancelCorrection();
      setCorrectionCount(0);
      // Use reanalysis with previous context instead of blind re-run
      if (name || items.length > 0) {
        triggerReanalyze();
      } else {
        triggerAnalyze();
      }
      setCorrectionText('');
      setCorrectionOpen(false);
      return;
    }
    triggerCorrection(trimmed);
  }

  // Auto-analyze on mount
  useEffect(() => {
    if (aiEnabled && aiSettings && !autoAnalyzedRef.current) {
      autoAnalyzedRef.current = true;
      triggerAnalyze();
    }
  }, [aiEnabled, aiSettings, triggerAnalyze]);

  function handleBack() {
    cancelAnalyze();
    cancelCorrection();
    cancelReanalyze();
    onBack();
  }

  async function handleCreate() {
    if (!name.trim() || !activeLocationId) return;
    setIsCreating(true);
    try {
      const itemsWithQty = mergeItemQuantities(items, itemQuantities);
      const createdBin = await addBin({
        name: name.trim(),
        locationId: activeLocationId,
        items: itemsWithQty,
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
      setSuccessBin({
        id: createdBin.id,
        name: name.trim(),
        icon,
        color,
        itemCount: items.length,
      });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : `Failed to create ${t.bin}`, variant: 'error' });
      setIsCreating(false);
    }
  }

  if (successBin) {
    return (
      <BinCreateSuccess
        createdBins={[successBin]}
        onCreateAnother={onRestart}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="space-y-5">
      <StepIndicator steps={steps} currentStepIndex={currentStepIndex} />

      {(isAnalyzing || isCorrecting || isReanalyzing) ? (
        <AiStreamingPreview
          previewUrls={previewUrls}
          streamedName={parsedPartial?.name ?? ''}
          streamedItems={parsedPartial?.items ?? []}
          initialStatusLabel={isCorrecting ? 'Applying correction...' : isReanalyzing ? 'Reanalyzing...' : `Analyzing ${Math.min(files.length, MAX_AI_PHOTOS)} photo${Math.min(files.length, MAX_AI_PHOTOS) !== 1 ? 's' : ''}...`}
        />
      ) : (
        <>
          {/* Photo preview (compact if reviewed) */}
          <div className="relative">
            {previewUrls.length === 1 ? (
              <img
                src={previewUrls[0]}
                alt="Preview 1"
                className={cn(
                  'w-full rounded-[var(--radius-lg)] object-cover bg-black/5 dark:bg-white/5 transition-all duration-500 ease-in-out',
                  name ? 'max-h-20 opacity-80' : 'aspect-square',
                )}
              />
            ) : (
              <div className="flex gap-2 overflow-x-auto">
                {previewUrls.map((url, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: preview URLs have no stable identity
                  <img key={i}
                    src={url}
                    alt={`Preview ${i + 1}`}
                    className={cn(
                      'shrink-0 flex-1 min-w-0 rounded-[var(--radius-lg)] object-cover bg-black/5 dark:bg-white/5 transition-all duration-500 ease-in-out',
                      name ? 'max-h-20 opacity-80' : 'aspect-square',
                    )}
                  />
                ))}
              </div>
            )}
            {aiEnabled && name && (
              <button
                type="button"
                onClick={() => setCorrectionOpen(!correctionOpen)}
                title="Adjust AI suggestions"
                className={cn(
                  'absolute top-2 right-2 p-1.5 rounded-full transition-colors',
                  correctionOpen
                    ? 'bg-[var(--ai-accent)] text-white'
                    : 'bg-black/40 text-white hover:bg-[var(--ai-accent)]',
                )}
              >
                <Sparkles className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* AI action bar (correction + reanalyze) */}
          <div className={correctionOpen && name ? 'ai-correction-enter' : 'hidden'}>
            <div className="space-y-2">
              {correctionCount >= MAX_CORRECTIONS ? (
                <p className="text-[12px] text-[var(--text-tertiary)] italic">
                  Max corrections reached. You can still edit any field below.
                </p>
              ) : (
                <>
                  <div className="row">
                    <Input
                      value={correctionText}
                      onChange={(e) => setCorrectionText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (correctionText.trim()) handleCorrectionSubmit(); } }}
                      placeholder="e.g. &quot;The red box has tools, not toys&quot;"
                      className="flex-1 h-9 text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={handleCorrectionSubmit}
                      disabled={!correctionText.trim()}
                      className="shrink-0 p-2 rounded-[var(--radius-lg)] bg-[var(--ai-accent)] text-white hover:bg-[var(--ai-accent-hover)] transition-colors disabled:opacity-40"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Describe what to fix, or reanalyze from scratch
                    </p>
                    <button
                      type="button"
                      onClick={() => { setCorrectionOpen(false); triggerReanalyze(); }}
                      className="text-[12px] text-[var(--ai-accent)] hover:underline shrink-0"
                    >
                      Reanalyze
                    </button>
                  </div>
                </>
              )}
            </div>
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
                Set up AI
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
          <div className="row-spread pt-2">
            <Button
              variant="ghost"
              onClick={handleBack}
              >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || isAnalyzing || isCorrecting || isReanalyzing || isCreating}
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
