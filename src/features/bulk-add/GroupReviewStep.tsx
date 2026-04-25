import { ArrowUp, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCw, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AiProgressBar } from '@/components/ui/ai-progress-bar';
import { AnimatedEllipsis } from '@/components/ui/animated-ellipsis';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AiSettingsSection } from '@/features/ai/AiSettingsSection';
import { AiAnalyzeError } from '@/features/ai/AiStreamingPreview';
import { MAX_AI_PHOTOS } from '@/features/ai/aiConstants';
import { mapAiError } from '@/features/ai/aiErrors';
import { useAiStream } from '@/features/ai/useAiStream';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { ColorPicker } from '@/features/bins/ColorPicker';
import { IconPicker } from '@/features/bins/IconPicker';
import { ItemList } from '@/features/bins/ItemList';
import { QuickAddWidget } from '@/features/bins/QuickAddWidget';
import { TagInput } from '@/features/bins/TagInput';
import { useAllTags } from '@/features/bins/useBins';
import { useQuickAdd } from '@/features/bins/useQuickAdd';
import { compressImageForAi } from '@/features/photos/compressImageForAi';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { aiItemsToBinItems } from '@/lib/itemQuantities';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { AiSettings, AiSuggestions } from '@/types';
import { type AnalyzeStreamMode, computeAnalyzeLabel } from './analyzeLabel';
import { PhotoScanFrame } from './PhotoScanFrame';
import { QueueDots } from './QueueDots';
import { computeReviewHeader } from './reviewHeader';
import type { BulkAddAction, Group, Photo } from './useBulkGroupAdd';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const MAX_CORRECTIONS = 3;

// Lock confirmation hold: CSS animations finish at ~240ms, leaving the
// brackets converged and "LOCKED" readout visible. The remainder is held
// stillness — long enough for the brain to register the lock as a discrete
// event before the photo collapse and form fade-in start.
export const LOCK_BEAT_MS = 600;

async function buildPhotosFormData(photos: Photo[]): Promise<FormData> {
  const compressed = await Promise.all(
    photos.map(async (p) => {
      const blob = await compressImageForAi(p.file);
      return blob instanceof File
        ? blob
        : new File([blob], p.file.name, { type: blob.type || 'image/jpeg' });
    }),
  );
  const formData = new FormData();
  if (compressed.length === 1) {
    formData.append('photo', compressed[0]);
  } else {
    for (const file of compressed) formData.append('photos', file);
  }
  return formData;
}

interface PendingResult {
  id: string;
  name: string;
  items: ReturnType<typeof aiItemsToBinItems>;
  isCorrection?: boolean;
}

interface GroupReviewStepProps {
  groups: Group[];
  currentIndex: number;
  editingFromSummary: boolean;
  aiSettings: AiSettings | null;
  dispatch: React.Dispatch<BulkAddAction>;
}

export function GroupReviewStep({ groups, currentIndex, editingFromSummary, aiSettings, dispatch }: GroupReviewStepProps) {
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const { aiEnabled, setAiEnabled } = useAiEnabled();
  const allTags = useAllTags();
  const [aiSetupExpanded, setAiSetupExpanded] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [confirmPhase, setConfirmPhase] = useState<'idle' | 'locking'>('idle');
  const lockTimerRef = useRef<number | null>(null);

  const pendingResult = useRef<PendingResult | null>(null);

  const autoAnalyzedRef = useRef(new Set<string>());
  const abortRef = useRef<Map<string, AbortController>>(new Map());

  const {
    isStreaming: isAnalyzingStream,
    error: analyzeStreamError,
    stream: streamAnalyze,
    cancel: cancelAnalyze,
    partialText: analyzePartialText,
  } = useAiStream<AiSuggestions>('/api/ai/analyze-image/stream', "Couldn't analyze the photo — try again");

  const {
    isStreaming: isCorrecting,
    error: correctionError,
    stream: streamCorrection,
    cancel: cancelCorrection,
    partialText: correctionPartialText,
  } = useAiStream<AiSuggestions>('/api/ai/correct/stream', "Couldn't correct — try again");

  const {
    isStreaming: isReanalyzing,
    error: reanalyzeError,
    stream: streamReanalyze,
    cancel: cancelReanalyze,
    partialText: reanalyzePartialText,
  } = useAiStream<AiSuggestions>('/api/ai/reanalyze-image/stream', "Couldn't reanalyze — try again");

  const group = groups[currentIndex];

  const reviewQuickAdd = useQuickAdd({
    binName: group?.name ?? '',
    existingItems: group?.items.map((i) => i.name) ?? [],
    activeLocationId: activeLocationId ?? undefined,
    onAdd: (newItems) => {
      if (!group) return;
      dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { items: [...group.items, ...newItems] } });
    },
  });

  if (!group) return null;

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === groups.length - 1;

  const isAnalyzing = group.status === 'analyzing';
  const isAnyActive = isAnalyzing || isAnalyzingStream || isReanalyzing || isCorrecting;
  const showProgressBar = isAnyActive || confirmPhase === 'locking';
  const anyError = group.analyzeError || analyzeStreamError || correctionError || reanalyzeError;

  // Surface stream errors that arrive via the hook's `error` state but never get
  // dispatched onto the group. Without this, a mid-stream error event makes the
  // hook return null, leaving the group's status stuck on 'analyzing' — the
  // progress bar spins forever and the error is hidden behind it.
  // biome-ignore lint/correctness/useHookAtTopLevel: group guard returns null above only if groups array is empty
  // biome-ignore lint/correctness/useExhaustiveDependencies: group?.status is intentionally narrower than group to avoid re-running on unrelated field changes
  useEffect(() => {
    if (!group || group.status !== 'analyzing') return;
    const streamError = analyzeStreamError || reanalyzeError || correctionError;
    if (streamError) {
      dispatch({ type: 'SET_ANALYZE_ERROR', id: group.id, error: streamError });
      setCorrectionOpen(false);
    }
  }, [analyzeStreamError, reanalyzeError, correctionError, group?.id, group?.status, dispatch]);

  function applyPendingResult() {
    const result = pendingResult.current;
    if (!result) return;
    pendingResult.current = null;

    dispatch({
      type: 'SET_ANALYZE_RESULT',
      id: result.id,
      name: result.name,
      items: result.items,
    });

    if (result.isCorrection) {
      dispatch({ type: 'INCREMENT_CORRECTION', id: result.id });
      setCorrectionText('');
      setCorrectionOpen(false);
    }
  }

  // Abort streams on unmount or navigate away
  // biome-ignore lint/correctness/useHookAtTopLevel: group guard returns null above only if groups array is empty
  useEffect(() => {
    return () => {
      for (const ctrl of abortRef.current.values()) ctrl.abort();
      abortRef.current.clear();
      cancelAnalyze();
      cancelCorrection();
      cancelReanalyze();
      if (lockTimerRef.current !== null) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
    };
  }, [cancelAnalyze, cancelCorrection, cancelReanalyze]);

  // Reset correction state when navigating between groups
  // biome-ignore lint/correctness/useExhaustiveDependencies: only reset on index change, setters are stable
  // biome-ignore lint/correctness/useHookAtTopLevel: group guard returns null above only if groups array is empty
  useEffect(() => {
    setCorrectionOpen(false);
    setCorrectionText('');
    pendingResult.current = null;
  }, [currentIndex]);

  async function triggerAnalyze(target: Group) {
    if (!aiSettings) {
      setAiSetupExpanded(true);
      return;
    }

    dispatch({ type: 'SET_ANALYZING', id: target.id });

    try {
      const formData = await buildPhotosFormData(target.photos.slice(0, MAX_AI_PHOTOS));
      if (activeLocationId) formData.append('locationId', activeLocationId);

      const result = await streamAnalyze(formData);
      if (result) {
        pendingResult.current = {
          id: target.id,
          name: result.name || '',
          items: aiItemsToBinItems(result.items || []),
        };
        if (prefersReducedMotion()) {
          applyPendingResult();
        } else {
          setConfirmPhase('locking');
          lockTimerRef.current = window.setTimeout(() => {
            setConfirmPhase('idle');
            lockTimerRef.current = null;
            applyPendingResult();
          }, LOCK_BEAT_MS);
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      dispatch({ type: 'SET_ANALYZE_ERROR', id: target.id, error: mapAiError(err, "Couldn't analyze the photo — try again") });
    }
  }

  async function triggerReanalyze(target: Group) {
    if (!aiSettings) {
      setAiSetupExpanded(true);
      return;
    }

    abortRef.current.get(target.id)?.abort();
    dispatch({ type: 'SET_ANALYZING', id: target.id });

    try {
      const formData = await buildPhotosFormData(target.photos.slice(0, MAX_AI_PHOTOS));
      const previousResult = {
        name: target.name,
        items: target.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      };
      formData.append('previousResult', JSON.stringify(previousResult));
      if (activeLocationId) formData.append('locationId', activeLocationId);

      const result = await streamReanalyze(formData);
      if (result) {
        pendingResult.current = {
          id: target.id,
          name: result.name || '',
          items: aiItemsToBinItems(result.items || []),
        };
        applyPendingResult();
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      dispatch({ type: 'SET_ANALYZE_ERROR', id: target.id, error: mapAiError(err, "Couldn't analyze the photo — try again") });
    }
  }

  async function triggerCorrection(target: Group, text: string) {
    abortRef.current.get(target.id)?.abort();
    dispatch({ type: 'SET_ANALYZING', id: target.id });

    const previousResult = {
      name: target.name,
      items: target.items.map((i) => ({ name: i.name, quantity: i.quantity })),
    };

    const result = await streamCorrection({
      previousResult,
      correction: text,
      locationId: activeLocationId || undefined,
    });

    if (result) {
      pendingResult.current = {
        id: target.id,
        name: result.name || '',
        items: aiItemsToBinItems(result.items || []),
        isCorrection: true,
      };
      applyPendingResult();
    }
  }

  function handleCorrectionSubmit() {
    const trimmed = correctionText.trim();
    if (!trimmed) {
      cancelCorrection();
      dispatch({ type: 'RESET_CORRECTION_COUNT', id: group.id });
      if (group.name || group.items.length > 0) {
        triggerReanalyze(group);
      } else {
        triggerAnalyze(group);
      }
      setCorrectionText('');
      setCorrectionOpen(false);
      return;
    }
    triggerCorrection(group, trimmed);
  }

  // Auto-analyze on first visit to each pending group
  // biome-ignore lint/correctness/useHookAtTopLevel: group guard returns null above only if groups array is empty
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on group?.id and status to avoid re-triggering
  useEffect(() => {
    if (group && group.status === 'pending' && aiEnabled && aiSettings && !autoAnalyzedRef.current.has(group.id)) {
      autoAnalyzedRef.current.add(group.id);
      triggerAnalyze(group);
    }
  }, [group?.id, group?.status, aiEnabled, aiSettings]);

  function flushPendingLock() {
    if (lockTimerRef.current !== null) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    if (confirmPhase === 'locking') {
      setConfirmPhase('idle');
      applyPendingResult();
    }
  }

  function handleBack() {
    flushPendingLock();
    abortRef.current.get(group.id)?.abort();
    cancelAnalyze();
    cancelCorrection();
    cancelReanalyze();
    // If user cancelled mid-stream, revert status so re-entering the group can re-trigger auto-analyze.
    if (group.status === 'analyzing') {
      dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { status: 'pending' } });
      autoAnalyzedRef.current.delete(group.id);
    }
    if (editingFromSummary) {
      dispatch({ type: 'GO_TO_SUMMARY' });
    } else if (isFirst) {
      dispatch({ type: 'GO_TO_GROUP' });
    } else {
      dispatch({ type: 'SET_CURRENT_INDEX', index: currentIndex - 1 });
    }
  }

  function handleNext() {
    flushPendingLock();
    abortRef.current.get(group.id)?.abort();
    cancelAnalyze();
    if (group.status === 'pending' || group.status === 'analyzing') {
      dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { status: 'reviewed' } });
    }
    if (isLast) {
      dispatch({ type: 'GO_TO_SUMMARY' });
    } else {
      dispatch({ type: 'SET_CURRENT_INDEX', index: currentIndex + 1 });
    }
  }

  const streamMode: AnalyzeStreamMode = confirmPhase === 'locking'
    ? 'locking'
    : isCorrecting
      ? 'correction'
      : isReanalyzing
        ? 'reanalyze'
        : isAnalyzingStream || isAnalyzing
          ? 'analyze'
          : 'idle';

  const streamPartialText = isCorrecting
    ? correctionPartialText
    : isReanalyzing
      ? reanalyzePartialText
      : analyzePartialText;

  const labelState = computeAnalyzeLabel({
    mode: streamMode,
    partialText: streamPartialText,
    complete: false,
  });

  const headerState = computeReviewHeader({
    groupCount: groups.length,
    currentIndex,
    photoCount: group.photos.length,
    editingFromSummary,
    isAnalyzing: isAnyActive,
    term: { bin: t.bin, Bin: t.Bin },
  });

  function handleCancel() {
    if (isCorrecting) cancelCorrection();
    else if (isReanalyzing) cancelReanalyze();
    else cancelAnalyze();
    dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { status: 'pending' } });
  }

  const reviewedCount = groups.filter((g) => g.status === 'reviewed').length;
  const showTryAiAgain =
    aiEnabled && !!aiSettings && group.status === 'pending' && !isAnyActive;

  return (
    <div data-tour="group-review" className="space-y-5">
      {/* Step title + progress */}
      <header className="space-y-1">
        <div className="row-spread">
          <h2 className="text-[17px] font-semibold leading-tight text-[var(--text-primary)]">
            {headerState.title}
          </h2>
          <QueueDots
            total={groups.length}
            currentIndex={currentIndex}
            doneCount={reviewedCount}
            termBin={t.Bin}
          />
        </div>
        {headerState.subtitle && (
          <p className="text-[13px] leading-snug text-[var(--text-secondary)]">
            {headerState.subtitle}
          </p>
        )}
      </header>

      {/* Photo preview — always visible. HUD overlay mounts during streaming. */}
      <div className="relative mx-auto max-w-sm">
        {(() => {
          const collapsed = !!group.name;
          const photoClasses = (extra?: string) =>
            cn(
              'rounded-[var(--radius-lg)] object-cover bg-black/5 dark:bg-white/5 transition-all duration-500 ease-in-out',
              collapsed ? 'block h-20 w-20 opacity-80' : 'w-full aspect-square',
              extra,
            );
          const photos =
            group.photos.length === 1 ? (
              <img
                src={group.photos[0].previewUrl}
                alt="Preview 1"
                className={photoClasses(collapsed ? 'mx-auto' : '')}
              />
            ) : (
              <div className={cn('flex gap-2', collapsed ? 'justify-center' : 'overflow-x-auto')}>
                {group.photos.map((photo, i) => (
                  <img
                    key={photo.id}
                    src={photo.previewUrl}
                    alt={`Preview ${i + 1}`}
                    className={photoClasses(collapsed ? 'shrink-0' : 'shrink-0 flex-1 min-w-0')}
                  />
                ))}
              </div>
            );
          const hudMounted = isAnyActive || confirmPhase === 'locking';
          const hudPhase: 'scanning' | 'locking' = confirmPhase === 'locking' ? 'locking' : 'scanning';
          return hudMounted ? (
            <PhotoScanFrame itemCount={labelState.itemCount} phase={hudPhase}>{photos}</PhotoScanFrame>
          ) : (
            photos
          );
        })()}
        {aiEnabled && group.status === 'reviewed' && !showProgressBar && (
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
        <div className="space-y-2">
          <AiProgressBar
            active={isAnyActive || confirmPhase === 'locking'}
            complete={confirmPhase === 'locking'}
            showSparkles={false}
            className="w-full"
          />
          <output aria-live="polite" className="row min-w-0">
            <span className="flex-1 truncate font-mono text-[12px] font-medium text-[var(--text-tertiary)]">
              {labelState.text}
              {labelState.showEllipsis && <AnimatedEllipsis />}
            </span>
            {isAnyActive && (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Cancel scan"
                onClick={handleCancel}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            )}
          </output>
        </div>
      ) : (
        <div className="animate-fade-in space-y-5">
          {/* AI action bar (correction + reanalyze) */}
          {correctionOpen && group.status === 'reviewed' && (
            <div className="animate-fade-in space-y-1.5">
              {group.correctionCount >= MAX_CORRECTIONS ? (
                <p className="text-[12px] text-[var(--text-tertiary)] italic">
                  You can still edit any field below.
                </p>
              ) : (
                <div className="row">
                  <Input
                    value={correctionText}
                    onChange={(e) => setCorrectionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCorrectionSubmit();
                      }
                    }}
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
                      onClick={() => { setCorrectionOpen(false); triggerReanalyze(group); }}
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
            <AiAnalyzeError error={anyError} onRetry={() => triggerAnalyze(group)} />
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
          {aiEnabled && aiSetupExpanded && !aiSettings && (
            <AiSettingsSection aiEnabled={aiEnabled} onToggle={setAiEnabled} />
          )}

          {/* Retry AI when user cancelled mid-stream */}
          {showTryAiAgain && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => triggerAnalyze(group)}
            >
              <RotateCw className="h-3.5 w-3.5 mr-1" />
              Try AI again
            </Button>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`name-${group.id}`}>Name</Label>
              <Input
                id={`name-${group.id}`}
                value={group.name}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { name: e.target.value } })
                }
                placeholder="e.g., Holiday Decorations"
              />
            </div>

            <div className="space-y-2">
              <ItemList
                items={group.items}
                onItemsChange={(items) =>
                  dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { items } })
                }
              />
              <QuickAddWidget quickAdd={reviewQuickAdd} aiEnabled={false} />
            </div>

            <div className="space-y-2">
              <Label>Area</Label>
              <AreaPicker
                locationId={activeLocationId ?? undefined}
                value={group.areaId}
                onChange={(areaId) =>
                  dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { areaId } })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`notes-${group.id}`}>Notes</Label>
              <Textarea
                id={`notes-${group.id}`}
                value={group.notes}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { notes: e.target.value } })
                }
                placeholder={`Notes about this ${t.bin}...`}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput
                tags={group.tags}
                onChange={(tags) =>
                  dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { tags } })
                }
                suggestions={allTags}
              />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker
                value={group.icon}
                onChange={(icon) =>
                  dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { icon } })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker
                value={group.color}
                onChange={(color) =>
                  dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { color } })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation — always visible so flushPendingLock fires even during the lock beat */}
      <div className="row-spread pt-2">
        <Button variant="ghost" onClick={handleBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          {editingFromSummary ? 'Back to summary' : 'Back'}
        </Button>
        {editingFromSummary ? (
          <Button onClick={() => dispatch({ type: 'GO_TO_SUMMARY' })}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Done
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={isAnyActive}>
            {isLast ? 'Review all' : 'Next'}
            {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        )}
      </div>
    </div>
  );
}
