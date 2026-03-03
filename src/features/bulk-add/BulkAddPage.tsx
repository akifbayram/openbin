import { ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MenuButton } from '@/components/ui/menu-button';
import { StepIndicator } from '@/components/ui/stepper';
import { useToast } from '@/components/ui/toast';
import { addBin } from '@/features/bins/useBins';
import { compressImage } from '@/features/photos/compressImage';
import { addPhoto } from '@/features/photos/usePhotos';
import { useAuth } from '@/lib/auth';
import { BulkAddReviewStep } from './BulkAddReviewStep';
import { BulkAddSummaryStep } from './BulkAddSummaryStep';
import { BulkAddUploadStep } from './BulkAddUploadStep';
import type { BulkAddPhoto } from './useBulkAdd';
import { BULK_ADD_STEPS, bulkAddReducer, bulkAddStepIndex, initialState } from './useBulkAdd';

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
      for (const p of photos) URL.revokeObjectURL(p.previewUrl);
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

  const currentStepIndex = bulkAddStepIndex(state);

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
        <StepIndicator steps={BULK_ADD_STEPS} currentStepIndex={currentStepIndex} className="flex-1" />
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
