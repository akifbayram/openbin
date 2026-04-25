import { ArrowUp, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCw, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AiProgressBar } from '@/components/ui/ai-progress-bar';
import { AnimatedEllipsis } from '@/components/ui/animated-ellipsis';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AiSettingsSection } from '@/features/ai/AiSettingsSection';
import { AiAnalyzeError } from '@/features/ai/AiStreamingPreview';
import { MAX_AI_PHOTOS } from '@/features/ai/aiConstants';
import { mapAiError } from '@/features/ai/aiErrors';
import { useAiStream } from '@/features/ai/useAiStream';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { AiBadge } from '@/features/bins/AiBadge';
import { ColorPicker } from '@/features/bins/ColorPicker';
import { IconPicker } from '@/features/bins/IconPicker';
import { ItemList } from '@/features/bins/ItemList';
import { QuickAddWidget } from '@/features/bins/QuickAddWidget';
import { TagInput } from '@/features/bins/TagInput';
import { useAllTags } from '@/features/bins/useBins';
import { useQuickAdd } from '@/features/bins/useQuickAdd';
import { compressImageForAi } from '@/features/photos/compressImageForAi';
import { useAiEnabled } from '@/lib/aiToggle';
import { isRecordingSupported } from '@/lib/audioRecorder';
import { useAuth } from '@/lib/auth';
import { aiItemsToBinItems } from '@/lib/itemQuantities';
import { useTerminology } from '@/lib/terminology';
import { useDictation } from '@/lib/useDictation';
import { cn } from '@/lib/utils';
import type { AiSettings, AiSuggestions, BinItem } from '@/types';
import { type AnalyzeStreamMode, computeAnalyzeLabel } from './analyzeLabel';
import { PhotoScanFrame } from './PhotoScanFrame';
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

  type AiField = 'name' | 'items';
  const [aiFilledFields, setAiFilledFields] = useState<Set<AiField>>(new Set());
  const [aiFillCycle, setAiFillCycle] = useState(0);
  const preAiValues = useRef<{ name: string; items: BinItem[] } | null>(null);

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

  const aiReady = aiEnabled && !!aiSettings;

  // Stabilized so useDictation's existingItems.join('\0') memo key doesn't churn per render.
  const existingItemNames = useMemo(
    () => group?.items.map((i) => i.name) ?? [],
    [group?.items],
  );
  const handleAddItems = (newItems: BinItem[]) => {
    if (!group) return;
    dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { items: [...group.items, ...newItems] } });
  };

  const reviewQuickAdd = useQuickAdd({
    binName: group?.name ?? '',
    existingItems: existingItemNames,
    activeLocationId: activeLocationId ?? undefined,
    aiConfigured: aiReady,
    onNavigateAiSetup: () => setAiSetupExpanded(true),
    onAdd: handleAddItems,
  });

  const reviewDictation = useDictation({
    binName: group?.name ?? '',
    existingItems: existingItemNames,
    locationId: activeLocationId ?? undefined,
    onAdd: handleAddItems,
  });

  const canTranscribe =
    aiReady && !!aiSettings?.provider && aiSettings.provider !== 'anthropic' && isRecordingSupported();

  if (!group) return null;

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === groups.length - 1;

  const isAnalyzing = group.status === 'analyzing';
  const isAnyActive = isAnalyzing || isAnalyzingStream || isReanalyzing || isCorrecting;
  const showProgressBar = isAnyActive || confirmPhase === 'locking';
  const anyError = group.analyzeError || analyzeStreamError || correctionError || reanalyzeError;
  const nameFilled = aiFilledFields.has('name');
  const itemsFilled = aiFilledFields.has('items');

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

    const filled = new Set<AiField>();
    if (result.name) filled.add('name');
    if (result.items.length > 0) filled.add('items');
    setAiFilledFields(filled);
    setAiFillCycle((c) => c + 1);

    if (result.isCorrection) {
      dispatch({ type: 'INCREMENT_CORRECTION', id: result.id });
      setCorrectionText('');
      setCorrectionOpen(false);
    }
  }

  function handleUndoAiField(field: AiField) {
    if (!preAiValues.current) return;
    const changes: Partial<Group> =
      field === 'name'
        ? { name: preAiValues.current.name }
        : { items: preAiValues.current.items };
    dispatch({ type: 'UPDATE_GROUP', id: group.id, changes });
    setAiFilledFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  function snapshotPreAi(target: Group) {
    preAiValues.current = { name: target.name, items: target.items };
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
    setAiFilledFields(new Set());
    preAiValues.current = null;
  }, [currentIndex]);

  async function triggerAnalyze(target: Group) {
    if (!aiSettings) {
      setAiSetupExpanded(true);
      return;
    }

    snapshotPreAi(target);
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
    snapshotPreAi(target);
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
    snapshotPreAi(target);
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

  function handleCancel() {
    if (isCorrecting) cancelCorrection();
    else if (isReanalyzing) cancelReanalyze();
    else cancelAnalyze();
    dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { status: 'pending' } });
  }

  const showTryAiAgain =
    aiEnabled && !!aiSettings && group.status === 'pending' && !isAnyActive;

  const sparklesButton = aiEnabled && group.status === 'reviewed' && !showProgressBar && (
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
  );

  return (
    <div data-tour="group-review" className="space-y-5">
      {/* Image stays mounted across analyze/review so it doesn't reflow when the lock beat ends — only the chrome swaps. */}
      <div className="relative">
        <img
          src={group.photos[0].previewUrl}
          alt={group.photos.length === 1 ? 'Preview' : `${group.photos.length} photos, showing first`}
          className="block w-full aspect-[16/9] rounded-[var(--radius-lg)] object-cover bg-black/5 dark:bg-white/5"
        />
        {group.photos.length > 1 && (
          <span
            aria-hidden="true"
            className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-0.5 font-mono text-[11px] font-medium text-white"
          >
            +{group.photos.length - 1}
          </span>
        )}
        {showProgressBar ? (
          <PhotoScanFrame
            itemCount={labelState.itemCount}
            phase={confirmPhase === 'locking' ? 'locking' : 'scanning'}
          />
        ) : (
          sparklesButton
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
          <div
            key={nameFilled ? `name-${aiFillCycle}` : 'name'}
            className={cn('space-y-2', nameFilled && 'ai-field-fill')}
            style={nameFilled ? ({ '--stagger': 0 } as React.CSSProperties) : undefined}
          >
            <div className="flex items-center justify-between">
              <Label htmlFor={`name-${group.id}`}>Name</Label>
              {nameFilled && <AiBadge onUndo={() => handleUndoAiField('name')} />}
            </div>
            <Input
              id={`name-${group.id}`}
              value={group.name}
              onChange={(e) =>
                dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { name: e.target.value } })
              }
              placeholder="e.g., Holiday Decorations"
              className="font-medium"
            />
          </div>

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

          <div
            key={itemsFilled ? `items-${aiFillCycle}` : 'items'}
            className={cn('space-y-2', itemsFilled && 'ai-field-fill')}
            style={itemsFilled ? ({ '--stagger': 1 } as React.CSSProperties) : undefined}
          >
            <ItemList
              items={group.items}
              onItemsChange={(items) =>
                dispatch({ type: 'UPDATE_GROUP', id: group.id, changes: { items } })
              }
              headerExtra={itemsFilled ? <AiBadge onUndo={() => handleUndoAiField('items')} /> : undefined}
              footerSlot={
                <QuickAddWidget
                  quickAdd={reviewQuickAdd}
                  aiEnabled={aiEnabled}
                  dictation={reviewDictation}
                  canTranscribe={canTranscribe}
                  variant="inline"
                  isEmptyList={group.items.length === 0}
                />
              }
            />
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

          <Disclosure
            label="More options"
            labelClassName="py-2 text-[var(--accent)] cursor-pointer"
          >
            <div className="space-y-5">
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
          </Disclosure>
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
