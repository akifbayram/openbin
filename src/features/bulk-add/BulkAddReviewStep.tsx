import { ArrowUp, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, SkipForward, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LabelThreshold } from '@/components/ui/ai-progress-bar';
import { AiProgressBar } from '@/components/ui/ai-progress-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AiSettingsSection } from '@/features/ai/AiSettingsSection';
import { AiAnalyzeError } from '@/features/ai/AiStreamingPreview';
import { mapErrorMessage } from '@/features/ai/useAiAnalysis';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { useAiStream } from '@/features/ai/useAiStream';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { ColorPicker } from '@/features/bins/ColorPicker';
import { IconPicker } from '@/features/bins/IconPicker';
import { ItemList } from '@/features/bins/ItemList';
import { TagInput } from '@/features/bins/TagInput';
import { useAllTags } from '@/features/bins/useBins';
import { compressImage } from '@/features/photos/compressImage';
import { useAiEnabled } from '@/lib/aiToggle';
import { apiStream } from '@/lib/apiStream';
import { useAuth } from '@/lib/auth';
import { aiItemsToBinItems } from '@/lib/itemQuantities';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { AiSuggestions, BinItem } from '@/types';
import type { BulkAddAction, BulkAddPhoto } from './useBulkAdd';

const ANALYZE_LABELS: LabelThreshold[] = [
  [0, 'Analyzing photo...'],
  [15, 'Identifying items...'],
  [45, 'Generating details...'],
  [75, 'Almost done...'],
];
const REANALYSIS_LABELS: LabelThreshold[] = [
  [0, 'Preparing reanalysis...'],
  [15, 'Comparing changes...'],
  [45, 'Updating suggestions...'],
  [75, 'Almost done...'],
];
const CORRECTION_LABELS: LabelThreshold[] = [
  [0, 'Applying correction...'],
  [15, 'Reprocessing...'],
  [45, 'Updating results...'],
  [75, 'Almost done...'],
];

interface PendingResult {
  id: string;
  name: string;
  items: BinItem[];
  tags: string[];
  notes: string;
}

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

  // Completion flash: defer result dispatch until after 600ms green bar
  const [analyzeComplete, setAnalyzeComplete] = useState(false);
  const pendingResult = useRef<PendingResult | null>(null);
  const pendingCorrectionMeta = useRef<{ increment: boolean } | null>(null);

  const applyPendingResult = useCallback(() => {
    const result = pendingResult.current;
    if (!result) return;
    pendingResult.current = null;

    dispatch({
      type: 'SET_ANALYZE_RESULT',
      id: result.id,
      name: result.name,
      items: result.items,
      tags: result.tags,
      notes: result.notes,
    });

    if (pendingCorrectionMeta.current?.increment) {
      dispatch({ type: 'INCREMENT_CORRECTION', id: result.id });
      setCorrectionText('');
      setCorrectionOpen(false);
    }
    pendingCorrectionMeta.current = null;
  }, [dispatch]);

  useEffect(() => {
    if (!analyzeComplete) return;
    const timer = setTimeout(() => {
      setAnalyzeComplete(false);
      applyPendingResult();
    }, 600);
    return () => clearTimeout(timer);
  }, [analyzeComplete, applyPendingResult]);

  const {
    isStreaming: isCorrecting,
    error: correctionError,
    stream: streamCorrection,
    cancel: cancelCorrection,
  } = useAiStream<AiSuggestions>('/api/ai/correct/stream', "Couldn't correct — try again");

  const {
    isStreaming: isReanalyzing,
    error: reanalyzeError,
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
  }, [cancelCorrection, cancelReanalyze]);

  // Reset correction state when navigating between photos
  useEffect(() => {
    setCorrectionOpen(false);
    setCorrectionText('');
    setAnalyzeComplete(false);
    pendingResult.current = null;
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
  const isAnyActive = isStreaming || isCorrecting;
  const showProgressBar = isAnyActive || analyzeComplete;
  const anyError = photo.analyzeError || correctionError || reanalyzeError;

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
          pendingResult.current = {
            id: target.id,
            name: result.name,
            items: aiItemsToBinItems(result.items),
            tags: result.tags,
            notes: result.notes,
          };
          pendingCorrectionMeta.current = null;
          setAnalyzeComplete(true);
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
        items: target.items.map((i) => ({ name: i.name, quantity: i.quantity })),
        tags: target.tags,
        notes: target.notes,
      };

      const formData = new FormData();
      formData.append('photo', file);
      formData.append('previousResult', JSON.stringify(previousResult));
      if (activeLocationId) formData.append('locationId', activeLocationId);

      const result = await streamReanalyze(formData);
      if (result) {
        pendingResult.current = {
          id: target.id,
          name: result.name,
          items: result.items.map((i, idx) => ({ id: `ai-${target.id}-${idx}`, name: i.name, quantity: i.quantity ?? null })),
          tags: result.tags,
          notes: result.notes,
        };
        pendingCorrectionMeta.current = null;
        setAnalyzeComplete(true);
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
      items: target.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      tags: target.tags,
      notes: target.notes,
    };

    const result = await streamCorrection({
      previousResult,
      correction: text,
      locationId: activeLocationId || undefined,
    });

    if (result) {
      pendingResult.current = {
        id: target.id,
        name: result.name,
        items: result.items.map((i, idx) => ({ id: `ai-${target.id}-${idx}`, name: i.name, quantity: i.quantity ?? null })),
        tags: result.tags,
        notes: result.notes,
      };
      pendingCorrectionMeta.current = { increment: true };
      setAnalyzeComplete(true);
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

      {/* Photo preview — always visible */}
      <div className="relative">
        <img
          src={photo.previewUrl}
          alt={`Preview ${currentIndex + 1}`}
          className={cn(
            'w-full rounded-[var(--radius-lg)] object-cover bg-black/5 dark:bg-white/5 transition-all duration-500 ease-in-out',
            (photo.status === 'reviewed' || showProgressBar) ? 'max-h-20 opacity-80' : 'aspect-square',
          )}
        />
        {aiEnabled && photo.status === 'reviewed' && !showProgressBar && (
          <button
            type="button"
            onClick={() => setCorrectionOpen(!correctionOpen)}
            title="Adjust AI suggestions"
            className={cn(
              'absolute top-2 right-2 p-1.5 rounded-full transition-colors animate-fade-in',
              correctionOpen
                ? 'bg-[var(--ai-accent)] text-white'
                : 'bg-black/40 text-white hover:bg-[var(--ai-accent)]',
            )}
          >
            <Sparkles className="h-4 w-4" />
          </button>
        )}
      </div>

      {showProgressBar ? (
        <div className="flex items-center justify-center min-h-[44px]">
          <AiProgressBar
            active={isAnyActive}
            complete={analyzeComplete}
            labels={isCorrecting
              ? CORRECTION_LABELS
              : isReanalyzing
                ? REANALYSIS_LABELS
                : ANALYZE_LABELS}
            className="w-full"
          />
        </div>
      ) : (
        <div className="animate-fade-in space-y-5">
          {/* AI action bar (correction + reanalyze) */}
          {correctionOpen && photo.status === 'reviewed' && (
            <div className="animate-fade-in space-y-1.5">
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
          {anyError && (
            <AiAnalyzeError error={anyError} onRetry={() => triggerAnalyze(photo)} />
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
              <ItemList
                items={photo.items}
                onItemsChange={(items) =>
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
                <Button onClick={handleNext} disabled={showProgressBar}>
                  {isLast ? 'Review all' : 'Next'}
                  {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
