import { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, Pencil, Plus, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveIcon } from '@/lib/iconMap';
import { getColorPreset } from '@/lib/colorPalette';
import { useTheme } from '@/lib/theme';
import type { BulkAddPhoto, BulkAddAction } from './useBulkAdd';

interface BulkAddSummaryStepProps {
  photos: BulkAddPhoto[];
  isCreating: boolean;
  createdCount: number;
  dispatch: React.Dispatch<BulkAddAction>;
  onCreateAll: () => void;
  onRetryFailed: () => void;
}

export function BulkAddSummaryStep({
  photos,
  isCreating,
  createdCount,
  dispatch,
  onCreateAll,
  onRetryFailed,
}: BulkAddSummaryStepProps) {
  const { theme } = useTheme();
  const [skippedExpanded, setSkippedExpanded] = useState(false);

  const confirmed = photos.filter(
    (p) => p.status === 'reviewed' || p.status === 'pending' || p.status === 'creating' || p.status === 'created'
  );
  const confirmedWithName = confirmed.filter((p) => p.name.trim());
  const skipped = photos.filter((p) => p.status === 'skipped');
  const failed = photos.filter((p) => p.status === 'failed');
  const createReady = confirmedWithName.filter((p) => p.status !== 'created' && p.status !== 'creating');
  const allCreated = confirmedWithName.length > 0 && confirmedWithName.every((p) => p.status === 'created');
  const totalToCreate = createReady.length + failed.length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[22px] font-bold text-[var(--text-primary)]">
          {isCreating
            ? `Creating ${createdCount}/${totalToCreate}...`
            : allCreated
              ? 'All bins created!'
              : `Create ${createReady.length} Bin${createReady.length !== 1 ? 's' : ''}`}
        </h2>
        {!isCreating && !allCreated && (
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Review your bins before creating them.
          </p>
        )}
      </div>

      {/* Progress bar during creation */}
      {isCreating && totalToCreate > 0 && (
        <div className="h-1.5 rounded-full bg-[var(--bg-active)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${(createdCount / totalToCreate) * 100}%` }}
          />
        </div>
      )}

      {/* Confirmed bins list */}
      <div className="space-y-2">
        {confirmedWithName.map((photo) => {
          const Icon = resolveIcon(photo.icon);
          const colorPreset = photo.color ? getColorPreset(photo.color) : undefined;
          const bgColor = colorPreset
            ? (theme === 'dark' ? colorPreset.bgDark : colorPreset.bg)
            : undefined;

          return (
            <div
              key={photo.id}
              className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3"
              style={bgColor ? { backgroundColor: bgColor } : undefined}
            >
              <img
                src={photo.previewUrl}
                alt={photo.name}
                className="h-10 w-10 rounded-[var(--radius-md)] object-cover shrink-0"
              />
              <div className="h-8 w-8 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-[var(--text-secondary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                  {photo.name}
                </p>
                <p className="text-[12px] text-[var(--text-tertiary)]">
                  {[
                    photo.items.length
                      ? `${photo.items.length} item${photo.items.length !== 1 ? 's' : ''}`
                      : null,
                    photo.tags.length
                      ? `${photo.tags.length} tag${photo.tags.length !== 1 ? 's' : ''}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No items or tags added'}
                </p>
              </div>
              {photo.status === 'created' && (
                <Check className="h-5 w-5 text-green-500 shrink-0" />
              )}
              {photo.status === 'creating' && (
                <Loader2 className="h-5 w-5 text-[var(--accent)] shrink-0 animate-spin" />
              )}
              {photo.status === 'failed' && (
                <AlertCircle className="h-5 w-5 text-[var(--destructive)] shrink-0" />
              )}
              {!isCreating && photo.status !== 'created' && photo.status !== 'failed' && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = photos.indexOf(photo);
                    dispatch({ type: 'SET_CURRENT_INDEX', index: idx });
                    dispatch({ type: 'GO_TO_REVIEW' });
                  }}
                  className="p-1.5 rounded-full hover:bg-[var(--bg-active)] transition-colors shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Failed items */}
      {failed.length > 0 && (
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-[var(--destructive)]">
            {failed.length} failed to create
          </p>
          {failed.map((photo) => (
            <div
              key={photo.id}
              className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 border border-red-500/20"
            >
              <AlertCircle className="h-5 w-5 text-[var(--destructive)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                  {photo.name}
                </p>
                <p className="text-[12px] text-[var(--destructive)]">{photo.createError}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skipped section */}
      {skipped.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setSkippedExpanded(!skippedExpanded)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]"
          >
            {skippedExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Skipped photos ({skipped.length})
          </button>
          {skippedExpanded && (
            <div className="mt-2 space-y-2">
              {skipped.map((photo) => (
                <div
                  key={photo.id}
                  className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 opacity-60"
                >
                  <img
                    src={photo.previewUrl}
                    alt="Skipped"
                    className="h-9 w-9 rounded-[var(--radius-md)] object-cover shrink-0"
                  />
                  <p className="text-[14px] text-[var(--text-secondary)] flex-1">Not included</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      dispatch({ type: 'UNSKIP_PHOTO', id: photo.id });
                      const idx = photos.indexOf(photo);
                      dispatch({ type: 'SET_CURRENT_INDEX', index: idx });
                      dispatch({ type: 'GO_TO_REVIEW' });
                    }}
                    className="h-7 px-2 text-[12px] rounded-[var(--radius-full)]"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Include
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={() => {
            dispatch({ type: 'SET_CURRENT_INDEX', index: photos.length - 1 });
            dispatch({ type: 'GO_TO_REVIEW' });
          }}
          disabled={isCreating}
          className="rounded-[var(--radius-full)]"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {!allCreated && (
          <Button
            onClick={failed.length > 0 ? onRetryFailed : onCreateAll}
            disabled={isCreating || (createReady.length === 0 && failed.length === 0)}
            className="rounded-[var(--radius-full)]"
          >
            {isCreating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {isCreating
              ? `Creating...`
              : failed.length > 0
                ? `Retry Failed (${failed.length})`
                : `Create ${createReady.length} Bin${createReady.length !== 1 ? 's' : ''}`}
          </Button>
        )}
      </div>
    </div>
  );
}
