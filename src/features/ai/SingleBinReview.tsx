import { ArrowUp, ChevronDown, ChevronLeft, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LabelThreshold } from '@/components/ui/ai-progress-bar';
import { AiProgressBar } from '@/components/ui/ai-progress-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepIndicator } from '@/components/ui/stepper';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { AiBadge } from '@/features/bins/AiBadge';
import type { CreatedBinInfo } from '@/features/bins/BinCreateSuccess';
import { BinCreateSuccess } from '@/features/bins/BinCreateSuccess';
import { ColorPicker } from '@/features/bins/ColorPicker';
import { IconPicker } from '@/features/bins/IconPicker';
import { ItemList } from '@/features/bins/ItemList';
import { QuickAddWidget } from '@/features/bins/QuickAddWidget';
import { TagInput } from '@/features/bins/TagInput';
import { addBin, notifyBinsChanged, useAllTags } from '@/features/bins/useBins';
import { useQuickAdd } from '@/features/bins/useQuickAdd';
import { BULK_ADD_STEPS } from '@/features/bulk-add/useBulkAdd';
import { compressImage } from '@/features/photos/compressImage';
import { addPhoto } from '@/features/photos/usePhotos';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { aiItemsToBinItems, binItemsToPayload } from '@/lib/itemQuantities';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { AiSuggestions, BinItem } from '@/types';
import { AiSettingsSection } from './AiSettingsSection';
import { AiAnalyzeError } from './AiStreamingPreview';

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

type AiField = 'name' | 'items' | 'notes' | 'tags';

export function SingleBinReview({ files, previewUrls, sharedAreaId, onBack, onClose, onRestart }: SingleBinReviewProps) {
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const { settings: aiSettings } = useAiSettings();
  const { aiEnabled, setAiEnabled } = useAiEnabled();
  const allTags = useAllTags();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [items, setItems] = useState<BinItem[]>([]);
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

  // AI field fill tracking
  const [aiFilledFields, setAiFilledFields] = useState<Set<AiField>>(new Set());
  const [aiFillCycle, setAiFillCycle] = useState(0);
  const preAiValues = useRef<{ name: string; items: BinItem[]; tags: string[]; notes: string } | null>(null);

  // Deferred AI result + completion flash
  const pendingAiResult = useRef<AiSuggestions | null>(null);
  const [analyzeComplete, setAnalyzeComplete] = useState(false);
  const wasStreamingRef = useRef(false);
  const expectingCompletionRef = useRef(false);

  const reviewQuickAdd = useQuickAdd({
    binName: name,
    existingItems: items.map((i) => i.name),
    activeLocationId: activeLocationId ?? undefined,
    onAdd: (newItems) => setItems((prev) => [...prev, ...newItems]),
  });

  const {
    isStreaming: isAnalyzing,
    error: analyzeError,
    stream: streamAnalyze,
    cancel: cancelAnalyze,
  } = useAiStream<AiSuggestions>('/api/ai/analyze-image/stream', "Couldn't analyze — try again");

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

  const [aiSetupExpanded, setAiSetupExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const isAnyStreaming = isAnalyzing || isCorrecting || isReanalyzing;
  const anyStreamError = analyzeError || correctionError || reanalyzeError;
  const showProgressBar = isAnyStreaming || analyzeComplete;

  const steps = BULK_ADD_STEPS;
  const currentStepIndex = showProgressBar ? 1 : isCreating ? 3 : 2;

  const autoAnalyzedRef = useRef(false);

  // Race-free completion detection — fires before paint
  useLayoutEffect(() => {
    const justStopped = wasStreamingRef.current && !isAnyStreaming;
    wasStreamingRef.current = isAnyStreaming;
    if (justStopped && expectingCompletionRef.current) {
      expectingCompletionRef.current = false;
      if (!anyStreamError) {
        setAnalyzeComplete(true);
      }
    }
  }, [isAnyStreaming, anyStreamError]);

  function applyPendingAiResult() {
    const result = pendingAiResult.current;
    if (!result) return;
    pendingAiResult.current = null;

    // preAiValues was snapshotted when the stream completed (in trigger functions)
    const filled = new Set<AiField>();

    if (result.name) { setName(result.name); filled.add('name'); }
    if (result.items?.length) { setItems(aiItemsToBinItems(result.items)); filled.add('items'); }
    if (result.tags?.length) { setTags(result.tags); filled.add('tags'); }
    if (result.notes) { setNotes(result.notes); filled.add('notes'); }

    setAiFilledFields(filled);
    setAiFillCycle(c => c + 1);
  }

  // Completion flash timer — apply deferred result after 600ms
  useEffect(() => {
    if (!analyzeComplete) return;
    const timer = setTimeout(() => {
      setAnalyzeComplete(false);
      applyPendingAiResult();
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- applyPendingAiResult reads from refs, no stale closure risk
  }, [analyzeComplete]);

  function handleUndoAiField(field: AiField) {
    if (!preAiValues.current) return;
    switch (field) {
      case 'name': setName(preAiValues.current.name); break;
      case 'items': setItems(preAiValues.current.items); break;
      case 'tags': setTags(preAiValues.current.tags); break;
      case 'notes': setNotes(preAiValues.current.notes); break;
    }
    setAiFilledFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  // Abort streams on unmount
  useEffect(() => {
    return () => {
      expectingCompletionRef.current = false;
      cancelAnalyze(); cancelCorrection(); cancelReanalyze();
    };
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
    preAiValues.current = { name, items, tags, notes };
    expectingCompletionRef.current = true;
    const result = await streamAnalyze(formData);
    if (result) {
      pendingAiResult.current = result;
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
      items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
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

    preAiValues.current = { name, items, tags, notes };
    expectingCompletionRef.current = true;
    const result = await streamReanalyze(formData);
    if (result) {
      pendingAiResult.current = result;
    }
  }, [files, aiSettings, activeLocationId, streamReanalyze, name, items, tags, notes]);

  const triggerCorrection = useCallback(async (text: string) => {
    const previousResult = { name, items, tags, notes };
    preAiValues.current = { name, items, tags, notes };
    expectingCompletionRef.current = true;
    const result = await streamCorrection({
      previousResult,
      correction: text,
      locationId: activeLocationId || undefined,
    });
    if (result) {
      pendingAiResult.current = result;
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
    expectingCompletionRef.current = false;
    cancelAnalyze();
    cancelCorrection();
    cancelReanalyze();
    onBack();
  }

  async function handleCreate() {
    if (!name.trim() || !activeLocationId) return;
    setIsCreating(true);
    try {
      const createdBin = await addBin({
        name: name.trim(),
        locationId: activeLocationId,
        items: binItemsToPayload(items),
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

  const photoCount = Math.min(files.length, MAX_AI_PHOTOS);
  const streamLabels: LabelThreshold[] = isCorrecting
    ? [[0, 'Applying correction...'], [15, 'Reprocessing...'], [45, 'Updating results...'], [75, 'Finishing up...']]
    : isReanalyzing
      ? [[0, 'Preparing reanalysis...'], [15, 'Comparing changes...'], [45, 'Updating suggestions...'], [75, 'Finishing up...']]
      : [[0, `Analyzing ${photoCount} photo${photoCount !== 1 ? 's' : ''}...`], [15, 'Identifying items...'], [45, 'Streaming results...'], [75, 'Finishing up...']];

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

      {/* Photo preview — always visible */}
      <div className="relative">
        {previewUrls.length === 1 ? (
          <img
            src={previewUrls[0]}
            alt="Preview 1"
            className={cn(
              'w-full rounded-[var(--radius-lg)] object-cover bg-black/5 dark:bg-white/5 transition-all duration-500 ease-in-out',
              (name || showProgressBar) ? 'max-h-20 opacity-80' : 'aspect-square',
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
                  (name || showProgressBar) ? 'max-h-20 opacity-80' : 'aspect-square',
                )}
              />
            ))}
          </div>
        )}
        {aiEnabled && name && !showProgressBar && (
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

      {showProgressBar ? (
        <div className="flex items-center justify-center min-h-[44px]">
          <AiProgressBar
            active={isAnyStreaming}
            complete={analyzeComplete}
            labels={streamLabels}
            className="w-full"
          />
        </div>
      ) : (
        <>
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

          {anyStreamError && <AiAnalyzeError error={anyStreamError} onRetry={triggerAnalyze} />}

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
            <div key={aiFilledFields.has('name') ? `name-${aiFillCycle}` : 'name'} className={cn('space-y-2', aiFilledFields.has('name') && 'ai-field-fill')} style={aiFilledFields.has('name') ? { '--stagger': 0 } as React.CSSProperties : undefined}>
              <div className="flex items-center justify-between">
                <Label htmlFor="single-bin-name">Name</Label>
                {aiFilledFields.has('name') && <AiBadge onUndo={() => handleUndoAiField('name')} />}
              </div>
              <Input
                id="single-bin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Holiday Decorations"
              />
            </div>

            <div key={aiFilledFields.has('items') ? `items-${aiFillCycle}` : 'items'} className={cn('space-y-2', aiFilledFields.has('items') && 'ai-field-fill')} style={aiFilledFields.has('items') ? { '--stagger': 1 } as React.CSSProperties : undefined}>
              <ItemList items={items} onItemsChange={setItems} headerExtra={aiFilledFields.has('items') ? <AiBadge onUndo={() => handleUndoAiField('items')} /> : undefined} />
              <QuickAddWidget quickAdd={reviewQuickAdd} aiEnabled={false} />
            </div>

            <div className="space-y-2">
              <Label>Area</Label>
              <AreaPicker
                locationId={activeLocationId ?? undefined}
                value={areaId}
                onChange={setAreaId}
              />
            </div>

            <div key={aiFilledFields.has('notes') ? `notes-${aiFillCycle}` : 'notes'} className={cn('space-y-2', aiFilledFields.has('notes') && 'ai-field-fill')} style={aiFilledFields.has('notes') ? { '--stagger': 2 } as React.CSSProperties : undefined}>
              <div className="flex items-center justify-between">
                <Label htmlFor="single-bin-notes">Notes</Label>
                {aiFilledFields.has('notes') && <AiBadge onUndo={() => handleUndoAiField('notes')} />}
              </div>
              <Textarea
                id="single-bin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`Notes about this ${t.bin}...`}
                rows={2}
              />
            </div>

            <div key={aiFilledFields.has('tags') ? `tags-${aiFillCycle}` : 'tags'} className={cn('space-y-2', aiFilledFields.has('tags') && 'ai-field-fill')} style={aiFilledFields.has('tags') ? { '--stagger': 3 } as React.CSSProperties : undefined}>
              <div className="flex items-center justify-between">
                <Label>Tags</Label>
                {aiFilledFields.has('tags') && <AiBadge onUndo={() => handleUndoAiField('tags')} />}
              </div>
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
              disabled={!name.trim() || showProgressBar || isCreating}
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
