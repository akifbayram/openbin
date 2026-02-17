import { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { Camera, X, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { addBin, notifyBinsChanged } from '@/features/bins/useBins';
import { addPhoto } from '@/features/photos/usePhotos';
import { compressImage } from '@/features/photos/compressImage';
import { bulkAddReducer, initialState, createBulkAddPhoto } from '@/features/bulk-add/useBulkAdd';
import { BulkAddReviewStep } from '@/features/bulk-add/BulkAddReviewStep';
import { BulkAddSummaryStep } from '@/features/bulk-add/BulkAddSummaryStep';
import { SingleBinReview } from './SingleBinReview';
import { MAX_AI_PHOTOS } from './useAiAnalysis';
import type { BulkAddPhoto, BulkAddState } from '@/features/bulk-add/useBulkAdd';

const MAX_PHOTOS = 20;

interface PhotoBulkAddProps {
  initialFiles: File[];
  onClose: () => void;
  onBack: () => void;
}

function initState(files: File[]): BulkAddState {
  return {
    ...initialState,
    photos: files.map((f) => createBulkAddPhoto(f, null)),
  };
}

export function PhotoBulkAdd({ initialFiles, onClose, onBack }: PhotoBulkAddProps) {
  const { activeLocationId } = useAuth();
  const { showToast } = useToast();
  const [state, dispatch] = useReducer(bulkAddReducer, initialFiles, initState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hadPhotos = useRef(initialFiles.length > 0);
  const [mode, setMode] = useState<'per-photo' | 'single-bin'>('per-photo');
  const [singleBinReview, setSingleBinReview] = useState(false);

  const effectiveMax = mode === 'single-bin' ? MAX_AI_PHOTOS : MAX_PHOTOS;

  // Cleanup ObjectURLs on unmount
  useEffect(() => {
    return () => {
      state.photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-go back if all photos removed in upload step (only after having had photos)
  useEffect(() => {
    if (state.photos.length > 0) hadPhotos.current = true;
    if (state.step === 'upload' && hadPhotos.current && state.photos.length === 0) {
      onBack();
    }
  }, [state.photos.length, state.step, onBack]);

  function handleAddMore(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remaining = effectiveMax - state.photos.length;
    const newFiles = Array.from(files).slice(0, remaining);
    if (newFiles.length === 0) return;
    const newPhotos = newFiles.map((f) => createBulkAddPhoto(f, state.sharedAreaId));
    dispatch({ type: 'ADD_PHOTOS', photos: newPhotos });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleRemove(id: string) {
    const photo = state.photos.find((p) => p.id === id);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    dispatch({ type: 'REMOVE_PHOTO', id });
  }

  const createBins = useCallback(
    async (toCreate: BulkAddPhoto[]) => {
      if (toCreate.length === 0 || !activeLocationId) return;

      dispatch({ type: 'START_CREATING' });

      let successCount = 0;
      for (const photo of toCreate) {
        dispatch({ type: 'SET_CREATING', id: photo.id });
        try {
          const binId = await addBin({
            name: photo.name.trim(),
            locationId: activeLocationId,
            items: photo.items,
            notes: photo.notes.trim(),
            tags: photo.tags,
            areaId: photo.areaId,
            icon: photo.icon,
            color: photo.color,
          });
          dispatch({ type: 'SET_CREATED', id: photo.id, binId });
          successCount++;
          // Upload photo fire-and-forget
          compressImage(photo.file)
            .then((compressed) => {
              const file =
                compressed instanceof File
                  ? compressed
                  : new File([compressed], photo.file.name, {
                      type: compressed.type || 'image/jpeg',
                    });
              return addPhoto(binId, file);
            })
            .catch(() => {});
        } catch (err) {
          dispatch({
            type: 'SET_CREATE_ERROR',
            id: photo.id,
            error: err instanceof Error ? err.message : 'Failed to create bin',
          });
        }
      }

      dispatch({ type: 'DONE_CREATING' });
      notifyBinsChanged();

      if (successCount === toCreate.length) {
        showToast({
          message: `Created ${successCount} bin${successCount !== 1 ? 's' : ''}`,
        });
        onClose();
      }
    },
    [activeLocationId, showToast, onClose]
  );

  const handleCreateAll = useCallback(() => {
    const toCreate = state.photos.filter(
      (p) => p.name.trim() && (p.status === 'reviewed' || p.status === 'pending')
    );
    createBins(toCreate);
  }, [state.photos, createBins]);

  const handleRetryFailed = useCallback(() => {
    const failed = state.photos.filter((p) => p.status === 'failed');
    createBins(failed);
  }, [state.photos, createBins]);

  if (singleBinReview) {
    return (
      <SingleBinReview
        files={state.photos.map((p) => p.file)}
        previewUrls={state.photos.map((p) => p.previewUrl)}
        sharedAreaId={state.sharedAreaId}
        onBack={() => setSingleBinReview(false)}
        onClose={onClose}
      />
    );
  }

  if (state.step === 'review') {
    return (
      <BulkAddReviewStep
        photos={state.photos}
        currentIndex={state.currentIndex}
        dispatch={dispatch}
      />
    );
  }

  if (state.step === 'summary') {
    return (
      <BulkAddSummaryStep
        photos={state.photos}
        isCreating={state.isCreating}
        createdCount={state.createdCount}
        dispatch={dispatch}
        onCreateAll={handleCreateAll}
        onRetryFailed={handleRetryFailed}
      />
    );
  }

  // Upload step — compact inline version
  const singleBinDisabled = state.photos.length > MAX_AI_PHOTOS;

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1.5 bg-[var(--bg-input)] rounded-[var(--radius-full)] p-1">
        <button
          type="button"
          onClick={() => setMode('per-photo')}
          className={cn(
            'flex-1 text-[13px] font-medium py-1.5 px-3 rounded-[var(--radius-full)] transition-colors',
            mode === 'per-photo'
              ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          )}
        >
          Separate bins
        </button>
        <button
          type="button"
          onClick={() => { if (!singleBinDisabled) setMode('single-bin'); }}
          className={cn(
            'flex-1 text-[13px] font-medium py-1.5 px-3 rounded-[var(--radius-full)] transition-colors',
            mode === 'single-bin'
              ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            singleBinDisabled && mode !== 'single-bin' && 'opacity-40 cursor-not-allowed'
          )}
        >
          Same bin
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleAddMore}
      />

      {/* Thumbnail grid */}
      <div className="grid grid-cols-4 gap-2">
        {state.photos.map((photo) => (
          <div key={photo.id} className="relative aspect-square group">
            <img
              src={photo.previewUrl}
              alt="Preview"
              className="h-full w-full rounded-[var(--radius-md)] object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(photo.id)}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center shadow-sm hover:bg-[var(--destructive)] hover:text-white transition-colors opacity-0 group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {state.photos.length < effectiveMax && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square flex flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            <Camera className="h-4 w-4" />
            <span className="text-[10px]">Add more</span>
          </button>
        )}
      </div>

      {/* Helper text */}
      <p className="text-[12px] text-[var(--text-tertiary)]">
        {mode === 'per-photo'
          ? 'Each photo will create a separate bin'
          : 'All photos will be analyzed together as one bin'}
      </p>

      {/* Shared area picker */}
      <div className="space-y-1.5">
        <Label className="text-[13px]">
          {mode === 'single-bin' ? 'Area (optional)' : 'Area for all bins (optional)'}
        </Label>
        <AreaPicker
          locationId={activeLocationId ?? undefined}
          value={state.sharedAreaId}
          onChange={(areaId) => dispatch({ type: 'SET_SHARED_AREA', areaId })}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="rounded-[var(--radius-full)]"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          Back
        </Button>
        <Button
          onClick={() => {
            if (mode === 'single-bin') {
              setSingleBinReview(true);
            } else {
              dispatch({ type: 'GO_TO_REVIEW' });
            }
          }}
          disabled={state.photos.length === 0}
          size="sm"
          className="rounded-[var(--radius-full)]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
