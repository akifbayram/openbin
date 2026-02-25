import { useReducer, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { addBin } from '@/features/bins/useBins';
import { addPhoto } from '@/features/photos/usePhotos';
import { compressImage } from '@/features/photos/compressImage';
import { bulkAddReducer, initialState, stepIndex } from './useBulkAdd';
import { BulkAddUploadStep } from './BulkAddUploadStep';
import { BulkAddReviewStep } from './BulkAddReviewStep';
import { BulkAddSummaryStep } from './BulkAddSummaryStep';
import { MenuButton } from '@/components/ui/menu-button';
import type { BulkAddPhoto } from './useBulkAdd';

const STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'review', label: 'Review' },
  { key: 'summary', label: 'Confirm' },
] as const;

export function BulkAddPage() {
  const navigate = useNavigate();
  const { activeLocationId } = useAuth();
  const { showToast } = useToast();
  const [state, dispatch] = useReducer(bulkAddReducer, initialState);

  // Redirect if no location
  useEffect(() => {
    if (!activeLocationId) navigate('/');
  }, [activeLocationId, navigate]);

  // Cleanup ObjectURLs on unmount
  useEffect(() => {
    const photos = state.photos;
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createBins = useCallback(
    async (toCreate: BulkAddPhoto[]) => {
      if (toCreate.length === 0 || !activeLocationId) return;

      dispatch({ type: 'START_CREATING' });

      let successCount = 0;
      for (const photo of toCreate) {
        dispatch({ type: 'SET_CREATING', id: photo.id });
        try {
          const createdBin = await addBin({
            name: photo.name.trim(),
            locationId: activeLocationId,
            items: photo.items,
            notes: photo.notes.trim(),
            tags: photo.tags,
            areaId: photo.areaId,
            icon: photo.icon,
            color: photo.color,
          });
          dispatch({ type: 'SET_CREATED', id: photo.id, binId: createdBin.id });
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
              return addPhoto(createdBin.id, file);
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

      if (successCount === toCreate.length) {
        showToast({
          message: `Created ${successCount} bin${successCount !== 1 ? 's' : ''}`,
        });
        navigate('/bins');
      }
    },
    [activeLocationId, showToast, navigate]
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

  if (!activeLocationId) return null;

  const currentStepIndex = stepIndex(state.step);

  return (
    <div className="page-content pb-8">
      {/* Back navigation */}
      {state.step === 'upload' && (
        <div className="flex items-center gap-1 mb-4">
          <MenuButton />
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="-ml-2 rounded-[var(--radius-full)] text-[var(--text-secondary)]"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {state.step !== 'upload' && <MenuButton />}
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-6 bg-[var(--border)]" />}
            <div
              className={cn(
                'h-7 px-3 rounded-[var(--radius-full)] flex items-center text-[13px] font-medium',
                currentStepIndex === i
                  ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                  : currentStepIndex > i
                    ? 'bg-[var(--bg-active)] text-[var(--text-secondary)]'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]'
              )}
            >
              {step.label}
            </div>
          </div>
        ))}
      </div>

      {state.step === 'upload' && (
        <BulkAddUploadStep
          photos={state.photos}
          sharedAreaId={state.sharedAreaId}
          dispatch={dispatch}
        />
      )}

      {state.step === 'review' && (
        <BulkAddReviewStep
          photos={state.photos}
          currentIndex={state.currentIndex}
          dispatch={dispatch}
        />
      )}

      {state.step === 'summary' && (
        <BulkAddSummaryStep
          photos={state.photos}
          isCreating={state.isCreating}
          createdCount={state.createdCount}
          dispatch={dispatch}
          onCreateAll={handleCreateAll}
          onRetryFailed={handleRetryFailed}
        />
      )}
    </div>
  );
}
