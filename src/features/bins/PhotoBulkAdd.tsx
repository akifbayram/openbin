import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CreatedBinInfo } from '@/features/bins/BinCreateSuccess';
import { BinCreateSuccess } from '@/features/bins/BinCreateSuccess';
import { addBin, notifyBinsChanged } from '@/features/bins/useBins';
import { GroupReviewStep } from '@/features/bulk-add/GroupReviewStep';
import { GroupSummaryStep } from '@/features/bulk-add/GroupSummaryStep';
import { PhotoGroupingGrid } from '@/features/bulk-add/PhotoGroupingGrid';
import {
  type BulkAddState,
  bulkAddReducer,
  computeFlowProgress,
  createGroupFromPhoto,
  createPhoto,
  type Group,
  initialState,
  type Photo,
} from '@/features/bulk-add/useBulkGroupAdd';
import { compressImage } from '@/features/photos/compressImage';
import { addPhoto } from '@/features/photos/usePhotos';
import { useAuth } from '@/lib/auth';
import { binItemsToPayload } from '@/lib/itemQuantities';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { AiSettings } from '@/types';

const DEMO_MAX_PHOTOS = 3;

function FlowProgress({ state }: { state: BulkAddState }) {
  const { dots, label, currentIndex, total, isAnalyzing } = computeFlowProgress(state);
  return (
    <div className="flex items-center justify-end gap-2">
      <span
        className={cn(
          'font-mono text-[11px] uppercase tracking-wider transition-colors duration-200 ease-out',
          isAnalyzing ? 'text-[var(--ai-accent)]' : 'text-[var(--text-tertiary)]',
        )}
      >
        {label}
      </span>
      {/* biome-ignore lint/a11y/useSemanticElements: role=group is the right ARIA match for an inline labeled grouping of related visuals */}
      <span
        role="group"
        aria-label={`Step ${currentIndex + 1} of ${total}: ${label}`}
        className="inline-flex items-center gap-1"
      >
        {dots.map((d) => (
          <span
            key={d.key}
            aria-hidden="true"
            className={cn(
              'h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out',
              d.state === 'current' ? 'w-[18px]' : 'w-1.5',
              d.state === 'current' && !isAnalyzing && 'bg-[var(--accent)]',
              d.state === 'current' && isAnalyzing && 'bg-[var(--ai-accent)] ai-thinking-pulse',
              d.state === 'done' && 'bg-[var(--accent)]',
              d.state === 'pending' && 'bg-[var(--text-quaternary)]',
            )}
          />
        ))}
      </span>
    </div>
  );
}

interface PhotoBulkAddProps {
  initialPhotos: File[];
  initialGroups?: number[] | null;
  aiSettings: AiSettings | null;
  /** Called when the wizard fully exits (success → "Close", or user dismiss). Caller navigates away. */
  onComplete: () => void;
  /** Called when the user wants to drop back to the single-bin form (cancel, or "Create another" after success). */
  onExitToForm: () => void;
  /** Portal target for the flow progress indicator (e.g. dialog title bar). Falls back to inline when null. */
  headerToolbarTarget?: HTMLElement | null;
}

export function initBulkAddStateFromFiles(
  files: File[],
  groupIds: number[] | null | undefined,
): BulkAddState {
  if (!groupIds || groupIds.length === 0 || groupIds.length !== files.length) {
    return {
      ...initialState,
      groups: files.map((f) => createGroupFromPhoto(createPhoto(f), null)),
    };
  }
  const buckets = new Map<number, Photo[]>();
  const order: number[] = [];
  for (let i = 0; i < files.length; i++) {
    const gid = groupIds[i];
    const photo = createPhoto(files[i]);
    let bucket = buckets.get(gid);
    if (!bucket) {
      bucket = [];
      buckets.set(gid, bucket);
      order.push(gid);
    }
    bucket.push(photo);
  }
  const groups: Group[] = order.map((gid) => {
    const photos = buckets.get(gid) ?? [];
    return {
      ...createGroupFromPhoto(photos[0], null),
      photos,
    };
  });
  return { ...initialState, groups };
}

export function PhotoBulkAdd({
  initialPhotos,
  initialGroups,
  aiSettings,
  onComplete,
  onExitToForm,
  headerToolbarTarget,
}: PhotoBulkAddProps) {
  const t = useTerminology();
  const { activeLocationId, demoMode: isDemo } = useAuth();
  const [state, dispatch] = useReducer(
    bulkAddReducer,
    { files: initialPhotos, groups: initialGroups ?? null },
    ({ files, groups }) => initBulkAddStateFromFiles(files, groups),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hadPhotos = useRef(initialPhotos.length > 0);
  const [successBins, setSuccessBins] = useState<CreatedBinInfo[] | null>(null);

  // Per-bin cap of 5 photos is enforced in the reducer; total upload count is unlimited (demo mode aside)
  const effectiveMax = isDemo ? DEMO_MAX_PHOTOS : Number.POSITIVE_INFINITY;
  const totalPhotos = state.groups.reduce((acc, g) => acc + g.photos.length, 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: cleanup-only effect
  useEffect(() => {
    return () => {
      for (const g of state.groups) {
        for (const p of g.photos) URL.revokeObjectURL(p.previewUrl);
      }
    };
  }, []);

  // Auto-back when all photos removed in group step
  useEffect(() => {
    if (totalPhotos > 0) hadPhotos.current = true;
    if (state.step === 'group' && hadPhotos.current && totalPhotos === 0) {
      onExitToForm();
    }
  }, [totalPhotos, state.step, onExitToForm]);

  // Single-bin shortcut bypasses the summary step, so the user has nowhere to
  // see the retry affordance when their lone create fails. Fall back to summary.
  const hasFailures = state.groups.some((g) => g.status === 'failed');
  useEffect(() => {
    if (state.step === 'review' && !state.isCreating && hasFailures) {
      dispatch({ type: 'GO_TO_SUMMARY' });
    }
  }, [state.step, state.isCreating, hasFailures]);

  function handleAddMore(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remaining = effectiveMax - totalPhotos;
    const newFiles = Array.from(files).slice(0, remaining);
    if (newFiles.length === 0) return;
    dispatch({ type: 'ADD_PHOTOS', photos: newFiles.map(createPhoto) });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const createBins = useCallback(
    async (toCreate: Group[]) => {
      if (toCreate.length === 0 || !activeLocationId) return;

      dispatch({ type: 'START_CREATING' });

      let successCount = 0;
      const createdBinInfos: CreatedBinInfo[] = [];
      for (const group of toCreate) {
        dispatch({ type: 'SET_CREATING', id: group.id });
        try {
          const createdBin = await addBin({
            name: group.name.trim(),
            locationId: activeLocationId,
            items: binItemsToPayload(group.items),
            notes: group.notes.trim(),
            tags: group.tags,
            areaId: group.areaId,
            icon: group.icon,
            color: group.color,
          });
          dispatch({ type: 'SET_CREATED', id: group.id, binId: createdBin.id });
          successCount++;
          createdBinInfos.push({
            id: createdBin.id,
            name: group.name.trim(),
            icon: group.icon,
            color: group.color,
            itemCount: group.items.length,
          });
          for (const photo of group.photos) {
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
          }
        } catch (err) {
          dispatch({
            type: 'SET_CREATE_ERROR',
            id: group.id,
            error: err instanceof Error ? err.message : `Failed to create ${t.bin}`,
          });
        }
      }

      dispatch({ type: 'DONE_CREATING' });
      notifyBinsChanged();

      if (successCount === toCreate.length) {
        setSuccessBins(createdBinInfos);
      }
    },
    [activeLocationId, t],
  );

  const handleCreateAll = useCallback(() => {
    const toCreate = state.groups.filter(
      (g) => g.name.trim() && (g.status === 'reviewed' || g.status === 'pending'),
    );
    createBins(toCreate);
  }, [state.groups, createBins]);

  const handleRetryFailed = useCallback(() => {
    const failed = state.groups.filter((g) => g.status === 'failed');
    createBins(failed);
  }, [state.groups, createBins]);

  if (successBins) {
    return (
      <div className="flex min-h-full flex-col">
        <BinCreateSuccess
          createdBins={successBins}
          onCreateAnother={() => {
            setSuccessBins(null);
            onExitToForm();
          }}
          onClose={onComplete}
        />
      </div>
    );
  }

  const flowProgress = <FlowProgress state={state} />;

  return (
    <div className="flex min-h-full flex-col gap-5">
      {headerToolbarTarget ? createPortal(flowProgress, headerToolbarTarget) : flowProgress}

      {state.step === 'group' && (
        <PhotoGroupingGrid
          state={state}
          dispatch={dispatch}
          effectiveMax={effectiveMax}
          locationId={activeLocationId}
          fileInputRef={fileInputRef}
          onAddMore={handleAddMore}
          onContinue={() => dispatch({ type: 'GO_TO_REVIEW' })}
          onBack={onExitToForm}
        />
      )}

      {state.step === 'review' && (
        <GroupReviewStep
          groups={state.groups}
          currentIndex={state.currentIndex}
          editingFromSummary={state.editingFromSummary}
          aiSettings={aiSettings}
          dispatch={dispatch}
          onCreateNow={handleCreateAll}
          isCreating={state.isCreating}
        />
      )}

      {state.step === 'summary' && (
        <GroupSummaryStep
          groups={state.groups}
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
