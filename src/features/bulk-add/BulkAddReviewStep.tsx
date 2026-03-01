import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, SkipForward, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AiSettingsSection } from '@/features/ai/AiSettingsSection';
import { analyzeImageFile, mapErrorMessage } from '@/features/ai/useAiAnalysis';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { ColorPicker } from '@/features/bins/ColorPicker';
import { IconPicker } from '@/features/bins/IconPicker';
import { ItemsInput } from '@/features/bins/ItemsInput';
import { TagInput } from '@/features/bins/TagInput';
import { useAllTags } from '@/features/bins/useBins';
import { compressImage } from '@/features/photos/compressImage';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import type { BulkAddAction, BulkAddPhoto } from './useBulkAdd';

interface BulkAddReviewStepProps {
  photos: BulkAddPhoto[];
  currentIndex: number;
  dispatch: React.Dispatch<BulkAddAction>;
}

export function BulkAddReviewStep({ photos, currentIndex, dispatch }: BulkAddReviewStepProps) {
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const { settings: aiSettings } = useAiSettings();
  const { aiEnabled, setAiEnabled } = useAiEnabled();
  const allTags = useAllTags();
  const [aiSetupExpanded, setAiSetupExpanded] = useState(false);
  const autoAnalyzedRef = useRef<Set<string>>(new Set());

  const photo = photos[currentIndex];

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

  async function triggerAnalyze(target: BulkAddPhoto) {
    if (!aiSettings) {
      setAiSetupExpanded(true);
      return;
    }
    dispatch({ type: 'SET_ANALYZING', id: target.id });
    try {
      const compressed = await compressImage(target.file);
      const file = compressed instanceof File
        ? compressed
        : new File([compressed], target.file.name, { type: compressed.type || 'image/jpeg' });
      const result = await analyzeImageFile(file, activeLocationId || undefined);
      dispatch({
        type: 'SET_ANALYZE_RESULT',
        id: target.id,
        name: result.name,
        items: result.items,
        tags: result.tags,
        notes: result.notes,
      });
    } catch (err) {
      dispatch({ type: 'SET_ANALYZE_ERROR', id: target.id, error: mapErrorMessage(err) });
    }
  }

  function handleNext() {
    if (photo.status === 'pending') {
      dispatch({ type: 'UPDATE_PHOTO', id: photo.id, changes: { status: 'reviewed' } });
    }
    if (isLast) {
      dispatch({ type: 'GO_TO_SUMMARY' });
    } else {
      dispatch({ type: 'SET_CURRENT_INDEX', index: currentIndex + 1 });
    }
  }

  function handleBack() {
    if (isFirst) {
      dispatch({ type: 'GO_TO_UPLOAD' });
    } else {
      dispatch({ type: 'SET_CURRENT_INDEX', index: currentIndex - 1 });
    }
  }

  function handleSkip() {
    dispatch({ type: 'SKIP_PHOTO', id: photo.id });
    if (isLast) {
      dispatch({ type: 'GO_TO_SUMMARY' });
    } else {
      dispatch({ type: 'SET_CURRENT_INDEX', index: currentIndex + 1 });
    }
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[13px] text-[var(--text-secondary)]">
          <span>Photo {currentIndex + 1} of {photos.length}</span>
          <span>{reviewedCount}/{photos.length} reviewed</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--bg-active)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${(reviewedCount / photos.length) * 100}%` }}
          />
        </div>
      </div>

      {photo.status === 'analyzing' ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
          <p className="text-[14px] text-[var(--text-secondary)]">Analyzing photo...</p>
        </div>
      ) : (
        <>
          {/* Photo preview */}
          <div className="relative">
            <img
              src={photo.previewUrl}
              alt={`Upload ${currentIndex + 1}`}
              className="w-full max-h-64 object-contain rounded-[var(--radius-lg)] bg-black/5 dark:bg-white/5"
            />
            {aiEnabled && (
              <button
                type="button"
                onClick={() => triggerAnalyze(photo)}
                title="Rescan"
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* AI Error */}
          {photo.analyzeError && (
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-red-500/10 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-[var(--destructive)] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[13px] text-[var(--destructive)]">{photo.analyzeError}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => triggerAnalyze(photo)}
                  className="mt-1 h-7 px-2 text-[12px]"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

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
              <Label>Items</Label>
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
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="rounded-[var(--radius-full)]"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="rounded-[var(--radius-full)] text-[var(--text-tertiary)]"
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Skip
              </Button>
              <Button
                onClick={handleNext}
                className="rounded-[var(--radius-full)]"
              >
                {isLast ? 'Done' : 'Next'}
                {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
