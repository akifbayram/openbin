import { ArrowUp, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, SkipForward, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AiSettingsSection } from '@/features/ai/AiSettingsSection';
import { AiAnalyzeError, AiStreamingPreview } from '@/features/ai/AiStreamingPreview';
import { mapErrorMessage } from '@/features/ai/useAiAnalysis';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { useAiStream } from '@/features/ai/useAiStream';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { ColorPicker } from '@/features/bins/ColorPicker';
import { IconPicker } from '@/features/bins/IconPicker';
import { ItemsInput } from '@/features/bins/ItemsInput';
import { TagInput } from '@/features/bins/TagInput';
import { useAllTags } from '@/features/bins/useBins';
import { compressImage } from '@/features/photos/compressImage';
import { useAiEnabled } from '@/lib/aiToggle';
import { apiStream } from '@/lib/apiStream';
import { useAuth } from '@/lib/auth';
import { buildQuantityMap } from '@/lib/itemQuantities';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { AiSuggestions } from '@/types';
import type { BulkAddAction, BulkAddPhoto } from './useBulkAdd';

interface BulkAddReviewStepProps {
  photos: BulkAddPhoto[];
  currentIndex: number;
  editingFromSummary: boolean;
  dispatch: React.Dispatch<BulkAddAction>;
}

export function BulkAddReviewStep({ photos, currentIndex, editingFromSummary, dispatch }: BulkAddReviewStepProps) {
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const { settings: aiSettings } = useAiSettings();
  const { aiEnabled, setAiEnabled } = useAiEnabled();
  const allTags = useAllTags();
  const [aiSetupExpanded, setAiSetupExpanded] = useState(false);
  const autoAnalyzedRef = useRef<Set<string>>(new Set());
  const abortRef = useRef<Map<string, AbortController>>(new Map());
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const MAX_CORRECTIONS = 3;

  const {
    isStreaming: isCorrecting,
    stream: streamCorrection,
    cancel: cancelCorrection,
  } = useAiStream<AiSuggestions>('/api/ai/correct/stream', "Couldn't correct — try again");

  const {
    isStreaming: isReanalyzing,
    stream: streamReanalyze,
    cancel: cancelReanalyze,
  } = useAiStream<AiSuggestions>('/api/ai/reanalyze-image/stream', "Couldn't reanalyze — try again");

  const photo = photos[currentIndex];

  // Abort streams on unmount or navigate away
  useEffect(() => {
    return () => {
      for (const ctrl of abortRef.current.values()) ctrl.abort();
      abortRef.current.clear();
      cancelCorrection();
      cancelReanalyze();
    };
  }, []);

  // Reset correction state when navigating between photos
  useEffect(() => {
    setCorrectionOpen(false);
    setCorrectionText('');
  }, [currentIndex]);

  // Auto-analyze on first visit to each photo
  useEffect(() => {
    if (photo && photo.status === 'pending' && aiEnabled && aiSettings && !autoAnalyzedRef.current.has(photo.id)) {
      autoAnalyzedRef.current.add(photo.id);
      triggerAnalyze(photo);
    }
  }, [photo?.id, photo?.status, aiSettings]);

  if (!photo) return null;

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === photos.length - 1;
  const reviewedCount = photos.filter((p) => p.status === 'reviewed' || p.status === 'skipped').length;

  const isStreaming = photo.status === 'analyzing' || isReanalyzing;

  async function triggerAnalyze(target: BulkAddPhoto) {
    if (!aiSettings) {
      setAiSetupExpanded(true);
      return;
    }

    // Abort any existing stream for this photo
    abortRef.current.get(target.id)?.abort();
    const controller = new AbortController();
    abortRef.current.set(target.id, controller);

    dispatch({ type: 'SET_ANALYZING', id: target.id });

    try {
      const compressed = await compressImage(target.file);
      const file = compressed instanceof File
        ? compressed
        : new File([compressed], target.file.name, { type: compressed.type || 'image/jpeg' });

      const formData = new FormData();
      formData.append('photo', file);
      if (activeLocationId) formData.append('locationId', activeLocationId);

      for await (const event of apiStream('/api/ai/analyze-image/stream', { body: formData, signal: controller.signal })) {
        if (event.type === 'done') {
          const result: AiSuggestions = JSON.parse(event.text);
          const qtyMap = buildQuantityMap(result.items);
          dispatch({
            type: 'SET_ANALYZE_RESULT',
            id: target.id,
            name: result.name,
            items: result.items.map((i) => i.name),
            itemQuantities: qtyMap,
            tags: result.tags,
            notes: result.notes,
          });
        } else if (event.type === 'error') {
          dispatch({ type: 'SET_ANALYZE_ERROR', id: target.id, error: event.message });
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      dispatch({ type: 'SET_ANALYZE_ERROR', id: target.id, error: mapErrorMessage(err) });
    } finally {
      abortRef.current.delete(target.id);
    }
  }

  async function triggerReanalyze(target: BulkAddPhoto) {
    if (!aiSettings) {
      setAiSetupExpanded(true);
      return;
    }

    // Abort any existing stream for this photo
    abortRef.current.get(target.id)?.abort();
    dispatch({ type: 'SET_ANALYZING', id: target.id });

    try {
      const compressed = await compressImage(target.file);
      const file = compressed instanceof File
        ? compressed
        : new File([compressed], target.file.name, { type: compressed.type || 'image/jpeg' });

      const previousResult = {
        name: target.name,
        items: target.items.map((name) => ({ name })),
        tags: target.tags,
        notes: target.notes,
      };

      const formData = new FormData();
      formData.append('photo', file);
      formData.append('previousResult', JSON.stringify(previousResult));
      if (activeLocationId) formData.append('locationId', activeLocationId);

      const result = await streamReanalyze(formData);
      if (result) {
        const qtyMap = buildQuantityMap(result.items);
        dispatch({
          type: 'SET_ANALYZE_RESULT',
          id: target.id,
          name: result.name,
          items: result.items.map((i) => i.name),
          itemQuantities: qtyMap,
          tags: result.tags,
          notes: result.notes,
        });
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      dispatch({ type: 'SET_ANALYZE_ERROR', id: target.id, error: mapErrorMessage(err) });
    }
  }

  async function triggerCorrection(target: BulkAddPhoto, text: string) {
    // Abort any pending analyze stream for this photo
    abortRef.current.get(target.id)?.abort();
    dispatch({ type: 'SET_ANALYZING', id: target.id });

    const previousResult = {
      name: target.name,
      items: target.items,
      tags: target.tags,
      notes: target.notes,
    };

    const result = await streamCorrection({
      previousResult,
      correction: text,
      locationId: activeLocationId || undefined,
    });

    if (result) {
      const qtyMap = buildQuantityMap(result.items);
      dispatch({
        type: 'SET_ANALYZE_RESULT',
        id: target.id,
        name: result.name,
        items: result.items.map((i) => i.name),
        itemQuantities: qtyMap,
        tags: result.tags,
        notes: result.notes,
      });
      dispatch({ type: 'INCREMENT_CORRECTION', id: target.id });
      setCorrectionText('');
      setCorrectionOpen(false);
    }
  }

  function handleCorrectionSubmit() {
    const trimmed = correctionText.trim();
    if (!trimmed) {
      cancelCorrection();
      dispatch({ type: 'RESET_CORRECTION_COUNT', id: photo.id });
      // Use reanalysis with previous context instead of blind re-run
      if (photo.name || photo.items.length > 0) {
        triggerReanalyze(photo);
      } else {
        triggerAnalyze(photo);
      }
      setCorrectionText('');
      setCorrectionOpen(false);
      return;
    }
    triggerCorrection(photo, trimmed);
  }

  function handleNext() {
    abortRef.current.get(photo.id)?.abort();
    if (photo.status === 'pending' || photo.status === 'analyzing') {
      dispatch({ type: 'UPDATE_PHOTO', id: photo.id, changes: { status: 'reviewed' } });
    }
    if (isLast) {
      dispatch({ type: 'GO_TO_SUMMARY' });
    } else {
      dispatch({ type: 'SET_CURRENT_INDEX', index: currentIndex + 1 });
    }
  }

  function handleBack() {
    abortRef.current.get(photo.id)?.abort();
    if (editingFromSummary) {
      dispatch({ type: 'GO_TO_SUMMARY' });
    } else if (isFirst) {
      dispatch({ type: 'GO_TO_UPLOAD' });
    } else {
      dispatch({ type: 'SET_CURRENT_INDEX', index: currentIndex - 1 });
    }
  }

  function handleSkip() {
    abortRef.current.get(photo.id)?.abort();
    dispatch({ type: 'SKIP_PHOTO', id: photo.id });
    if (isLast) {
      dispatch({ type: 'GO_TO_SUMMARY' });
    } else {
      dispatch({ type: 'SET_CURRENT_INDEX', index: currentIndex + 1 });
    }
  }

  return (
    <div className="space-y-5">
      {/* Photo counter (hidden for single photo) */}
      {photos.length > 1 && (
        <div className="row-spread text-[13px] text-[var(--text-secondary)]">
          <span>Photo {currentIndex + 1} of {photos.length}</span>
          <span>{reviewedCount}/{photos.length} reviewed</span>
        </div>
      )}

      {(isStreaming || isCorrecting) ? (
        <AiStreamingPreview
          previewUrls={[photo.previewUrl]}
          streamedName=""
          streamedItems={[]}
          initialStatusLabel={isCorrecting ? 'Applying correction...' : isReanalyzing ? 'Reanalyzing photo...' : 'Analyzing photo...'}
        />
      ) : (
        <>
          {/* Phase C: Reviewed / editable form */}
          {/* Photo preview (compact if reviewed) */}
          <div className="relative">
            <img
              src={photo.previewUrl}
              alt={`Preview ${currentIndex + 1}`}
              className={cn(
                'w-full rounded-[var(--radius-lg)] bg-black/5 dark:bg-white/5 transition-all duration-500 ease-in-out',
                photo.status === 'reviewed' ? 'max-h-20 object-cover opacity-80' : 'aspect-square object-cover',
              )}
            />
            {aiEnabled && photo.status === 'reviewed' && (
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
          {correctionOpen && photo.status === 'reviewed' && (
            <div className="space-y-1.5">
              {photo.correctionCount >= MAX_CORRECTIONS ? (
                <p className="text-[12px] text-[var(--text-tertiary)] italic">
                  You can still edit any field below.
                </p>
              ) : (
                <div className="row">
                  <Input
                    value={correctionText}
                    onChange={(e) => setCorrectionText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCorrectionSubmit(); } }}
                    placeholder="Optionally describe what to fix..."
                    className="flex-1 h-9 text-[13px]"
                  />
                  {correctionText.trim() ? (
                    <button
                      type="button"
                      onClick={handleCorrectionSubmit}
                      className="shrink-0 p-2 rounded-[var(--radius-lg)] bg-[var(--ai-accent)] text-white hover:bg-[var(--ai-accent-hover)] transition-colors"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setCorrectionOpen(false); triggerReanalyze(photo); }}
                      className="shrink-0 h-9 px-3 rounded-[var(--radius-lg)] bg-[var(--ai-accent)] text-white hover:bg-[var(--ai-accent-hover)] transition-colors text-[13px] font-medium"
                    >
                      Reanalyze
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Error */}
          {photo.analyzeError && (
            <AiAnalyzeError error={photo.analyzeError} onRetry={() => triggerAnalyze(photo)} />
          )}

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
          {aiEnabled && aiSetupExpanded && !aiSettings && <AiSettingsSection aiEnabled={aiEnabled} onToggle={setAiEnabled} />}

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`name-${photo.id}`}>Name</Label>
              <Input
                id={`name-${photo.id}`}
                value={photo.name}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_PHOTO', id: photo.id, changes: { name: e.target.value } })
                }
                placeholder="e.g., Holiday Decorations"
              />
            </div>

            <div className="space-y-2">
              <ItemsInput
                items={photo.items}
                onChange={(items) =>
                  dispatch({ type: 'UPDATE_PHOTO', id: photo.id, changes: { items } })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Area</Label>
              <AreaPicker
                locationId={activeLocationId ?? undefined}
                value={photo.areaId}
                onChange={(areaId) =>
                  dispatch({ type: 'UPDATE_PHOTO', id: photo.id, changes: { areaId } })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`notes-${photo.id}`}>Notes</Label>
              <Textarea
                id={`notes-${photo.id}`}
                value={photo.notes}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_PHOTO', id: photo.id, changes: { notes: e.target.value } })
                }
                placeholder={`Notes about this ${t.bin}...`}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput
                tags={photo.tags}
                onChange={(tags) =>
                  dispatch({ type: 'UPDATE_PHOTO', id: photo.id, changes: { tags } })
                }
                suggestions={allTags}
              />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker
                value={photo.icon}
                onChange={(icon) =>
                  dispatch({ type: 'UPDATE_PHOTO', id: photo.id, changes: { icon } })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker
                value={photo.color}
                onChange={(color) =>
                  dispatch({ type: 'UPDATE_PHOTO', id: photo.id, changes: { color } })
                }
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="row-spread pt-2">
            <Button
              variant="ghost"
              onClick={handleBack}
              >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {editingFromSummary ? 'Back to summary' : 'Back'}
            </Button>
            <div className="row">
              {!editingFromSummary && (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="rounded-[var(--radius-lg)] text-[var(--text-tertiary)]"
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  Skip
                </Button>
              )}
              {editingFromSummary ? (
                <Button onClick={() => dispatch({ type: 'GO_TO_SUMMARY' })}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Done
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  {isLast ? 'Review all' : 'Next'}
                  {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
