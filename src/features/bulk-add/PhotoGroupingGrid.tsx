import { ChevronLeft, Plus, X } from 'lucide-react';
import { Fragment, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useTerminology } from '@/lib/terminology';
import type { BulkAddAction, BulkAddState, Photo } from './useBulkGroupAdd';
import { MAX_PHOTOS_PER_GROUP } from './useBulkGroupAdd';

interface PhotoGroupingGridProps {
  state: BulkAddState;
  dispatch: React.Dispatch<BulkAddAction>;
  effectiveMax: number;
  locationId: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAddMore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function PhotoGroupingGrid({
  state,
  dispatch,
  effectiveMax,
  locationId,
  fileInputRef,
  onAddMore,
  onContinue,
  onBack,
}: PhotoGroupingGridProps) {
  const t = useTerminology();
  const totalPhotos = state.groups.reduce((acc, g) => acc + g.photos.length, 0);
  const { showToast } = useToast();
  const lastToggleRef = useRef<typeof state.lastToggle>(null);

  // Surface a new lastToggle as a toast — fires on each new toggle, then schedules CLEAR_LAST_TOGGLE after 4s
  useEffect(() => {
    if (state.lastToggle && state.lastToggle !== lastToggleRef.current) {
      lastToggleRef.current = state.lastToggle;
      showToast({
        message: state.lastToggle.verb,
        duration: 4000,
        action: { label: 'Undo', onClick: () => dispatch({ type: 'UNDO_LAST_TOGGLE' }) },
      });
      const timer = setTimeout(() => dispatch({ type: 'CLEAR_LAST_TOGGLE' }), 4000);
      return () => clearTimeout(timer);
    }
    if (!state.lastToggle) {
      lastToggleRef.current = null;
    }
  }, [state.lastToggle, showToast, dispatch]);

  let displayIndex = 0;

  return (
    <div className="flex min-h-full flex-col gap-4">
      {/* Counts header */}
      <div className="space-y-1">
        <div className="text-[13px] text-[var(--text-primary)]">
          {`${totalPhotos} ${totalPhotos === 1 ? 'photo' : 'photos'} · ${state.groups.length} ${state.groups.length === 1 ? t.bin : t.bins}`}
        </div>
        {totalPhotos > 1 && (
          <div className="text-[12px] font-bold text-[var(--text-secondary)]">
            Tap a gap to join {t.bins}
          </div>
        )}
      </div>

      {/* Helper strip */}
      {totalPhotos > 1 && !state.lastToggle && (
        <div className="text-[12px] italic text-[var(--text-tertiary)]">
          Default: each photo = own {t.bin}.
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onAddMore}
      />

      <div className="flex flex-wrap gap-y-3 items-stretch">
        {state.groups.map((group, gi) => {
          const groupStartPhotoIndex = state.groups.slice(0, gi).reduce((acc, g) => acc + g.photos.length, 0);
          const wouldExceedCap =
            gi > 0 &&
            state.groups[gi - 1].photos.length + group.photos.length > MAX_PHOTOS_PER_GROUP;
          return (
            <Fragment key={group.id}>
              {gi > 0 && (
                <SplitGap
                  leftBinNumber={gi}
                  rightBinNumber={gi + 1}
                  disabled={wouldExceedCap}
                  onClick={() => {
                    if (wouldExceedCap) {
                      showToast({
                        message: 'Max 5 photos per bin — split this group first',
                        variant: 'warning',
                        duration: 2000,
                      });
                    } else {
                      dispatch({ type: 'JOIN_AT', boundaryIndex: groupStartPhotoIndex });
                    }
                  }}
                />
              )}
              <div className="flex items-stretch border border-[var(--border-strong)] rounded-[var(--radius-md)] p-1">
                {group.photos.map((photo, pi) => {
                  const idx = ++displayIndex;
                  const photoIndex = groupStartPhotoIndex + pi;
                  return (
                    <Fragment key={photo.id}>
                      {pi > 0 && (
                        <JoinedGap
                          binNumber={gi + 1}
                          onClick={() => dispatch({ type: 'SPLIT_AT', boundaryIndex: photoIndex })}
                        />
                      )}
                      <PhotoTile
                        photo={photo}
                        indexLabel={idx}
                        onRemove={() => dispatch({ type: 'REMOVE_PHOTO', photoId: photo.id })}
                      />
                    </Fragment>
                  );
                })}
              </div>
            </Fragment>
          );
        })}
        {totalPhotos < effectiveMax && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add more photos"
            className="h-20 w-20 shrink-0 flex items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px]">{`${t.Area} for all ${t.bins} (optional)`}</Label>
        <AreaPicker
          locationId={locationId ?? undefined}
          value={state.sharedAreaId}
          onChange={(areaId) => dispatch({ type: 'SET_SHARED_AREA', areaId })}
        />
      </div>

      <div className="row-spread mt-auto pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button onClick={onContinue} disabled={state.groups.length === 0}>
          Continue
        </Button>
      </div>
    </div>
  );
}

interface PhotoTileProps {
  photo: Photo;
  indexLabel: number;
  onRemove: () => void;
}

function PhotoTile({ photo, indexLabel, onRemove }: PhotoTileProps) {
  return (
    <div className="group relative h-20 w-20 shrink-0">
      {/* biome-ignore lint/a11y/noRedundantAlt: accessible name must match /photo \d+/i for tests */}
      <img src={photo.previewUrl} alt={`Photo ${indexLabel}`} className="h-full w-full rounded-[var(--radius-sm)] object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove photo ${indexLabel}`}
        className="absolute top-1 right-1 size-7 flex items-center justify-center rounded-[var(--radius-xs)] bg-[var(--overlay-button)] text-white opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity hover:bg-[var(--overlay-button-hover)] hover:text-[var(--destructive)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface SplitGapProps {
  leftBinNumber: number;
  rightBinNumber: number;
  disabled: boolean;
  onClick: () => void;
}

function SplitGap({ leftBinNumber, rightBinNumber, disabled, onClick }: SplitGapProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={disabled}
      aria-label={`Join bin ${leftBinNumber} with bin ${rightBinNumber}`}
      className="shrink-0 h-20 w-[14px] px-4 flex items-center justify-center"
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span className="sr-only">Join</span>
    </button>
  );
}

interface JoinedGapProps {
  binNumber: number;
  onClick: () => void;
}

function JoinedGap({ binNumber, onClick }: JoinedGapProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Split bin ${binNumber}`}
      className="shrink-0 h-20 w-[8px] px-3 flex items-center justify-center cursor-pointer"
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: 'var(--accent)' }}
        aria-hidden="true"
      />
    </button>
  );
}
