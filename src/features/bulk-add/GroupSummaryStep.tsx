import { AlertCircle, Check, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveColor } from '@/lib/colorPalette';
import { useTerminology } from '@/lib/terminology';
import type { BulkAddAction, Group } from './useBulkGroupAdd';

interface GroupSummaryStepProps {
  groups: Group[];
  isCreating: boolean;
  createdCount: number;
  dispatch: React.Dispatch<BulkAddAction>;
  onCreateAll: () => void;
  onRetryFailed: () => void;
}

export function GroupSummaryStep({
  groups,
  isCreating,
  createdCount,
  dispatch,
  onCreateAll,
  onRetryFailed,
}: GroupSummaryStepProps) {
  const t = useTerminology();

  const confirmed = groups.filter((g) =>
    ['reviewed', 'pending', 'creating', 'created'].includes(g.status),
  );
  const failed = groups.filter((g) => g.status === 'failed');
  const createReady = confirmed.filter(
    (g) => g.name.trim() && g.status !== 'created' && g.status !== 'creating',
  );
  const unnamedCount = confirmed.filter((g) => !g.name.trim()).length;
  const namedConfirmed = confirmed.filter((g) => g.name.trim());
  const allCreated =
    namedConfirmed.length > 0 &&
    failed.length === 0 &&
    namedConfirmed.every((g) => g.status === 'created');
  const totalToCreate = createReady.length + failed.length;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-[18px] font-semibold leading-tight text-[var(--text-primary)]">
          {isCreating
            ? `Creating ${createdCount}/${totalToCreate}...`
            : allCreated
              ? `All ${t.bins} created!`
              : `Create ${createReady.length} ${createReady.length !== 1 ? t.Bins : t.Bin}`}
        </h2>
        {!isCreating && !allCreated && (
          <p className="text-[13px] leading-snug text-[var(--text-secondary)]">
            Tap any {t.bin} to edit before creating.
            {unnamedCount > 0 && (
              <>
                {' '}
                <span className="text-[var(--text-tertiary)]">
                  {unnamedCount} unnamed {unnamedCount === 1 ? t.bin : t.bins} won't be created.
                </span>
              </>
            )}
          </p>
        )}
      </header>

      {/* Progress bar during creation */}
      {isCreating && totalToCreate > 0 && (
        <div className="h-1.5 rounded-full bg-[var(--bg-active)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${(createdCount / totalToCreate) * 100}%` }}
          />
        </div>
      )}

      {/* Confirmed groups list — includes unnamed bins (rendered as "Untitled") so users see what they grouped */}
      <div className="space-y-2">
        {confirmed.map((group) => {
          const realIndex = groups.indexOf(group);
          const colorPreset = group.color ? resolveColor(group.color) : undefined;
          const bgColor = colorPreset?.bgCss;
          const hasName = group.name.trim().length > 0;
          const displayName = hasName ? group.name : 'Untitled bin';
          const editLabel = hasName ? `Edit ${group.name}` : `Edit untitled bin ${realIndex + 1}`;

          return (
            <div
              key={group.id}
              className="flat-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3"
              style={bgColor ? { backgroundColor: bgColor } : undefined}
            >
              <img
                src={group.photos[0].previewUrl}
                alt=""
                className="h-10 w-10 rounded-[var(--radius-sm)] object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium text-[14px] truncate ${
                    hasName
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)] italic'
                  }`}
                >
                  {displayName}
                </div>
                <div className="text-[12px] text-[var(--text-secondary)] flex gap-2">
                  <span>
                    {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                  </span>
                  {group.photos.length > 1 && <span>· {group.photos.length} photos</span>}
                  {!hasName && (
                    <span className="text-[var(--text-tertiary)]">· needs a name</span>
                  )}
                </div>
              </div>
              {group.status === 'created' && (
                <Check className="h-5 w-5 text-[var(--color-success)] shrink-0" />
              )}
              {group.status === 'creating' && (
                <Loader2 className="h-5 w-5 text-[var(--accent)] shrink-0 animate-spin" />
              )}
              {group.status === 'failed' && (
                <AlertCircle className="h-5 w-5 text-[var(--destructive)] shrink-0" />
              )}
              {!isCreating && group.status !== 'created' && group.status !== 'failed' && (
                <button
                  type="button"
                  aria-label={editLabel}
                  onClick={() => {
                    dispatch({ type: 'SET_EDITING_FROM_SUMMARY', value: true });
                    dispatch({ type: 'SET_CURRENT_INDEX', index: realIndex });
                    dispatch({ type: 'GO_TO_REVIEW' });
                  }}
                  className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-active)]"
                >
                  <Pencil className="h-4 w-4" />
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
            Couldn't create {failed.length} {failed.length !== 1 ? t.bins : t.bin}
          </p>
          {failed.map((group) => (
            <div
              key={group.id}
              className="flat-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 border border-[var(--destructive)]/20"
            >
              <AlertCircle className="h-5 w-5 text-[var(--destructive)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                  {group.name}
                </p>
                <p className="text-[12px] text-[var(--destructive)]">{group.createError}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {!isCreating && createReady.length > 0 && (
        <Button
          onClick={onCreateAll}
          aria-label={`Create ${createReady.length} ${createReady.length !== 1 ? t.Bins : t.Bin}`}
          className="w-full"
        >
          Create All ({createReady.length} {createReady.length !== 1 ? t.bins : t.bin})
        </Button>
      )}

      {failed.length > 0 && !isCreating && (
        <Button variant="ghost" onClick={onRetryFailed} className="w-full">
          Retry {failed.length} failed
        </Button>
      )}
    </div>
  );
}
