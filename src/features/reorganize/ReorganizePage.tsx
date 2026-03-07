import { Sparkles } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAreaList } from '@/features/areas/useAreas';
import { useBinList } from '@/features/bins/useBins';
import { BinSelectorCard } from '@/features/print/BinSelectorCard';
import { useBinSelection } from '@/features/print/useBinSelection';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { ReorganizePreview } from './ReorganizePreview';
import { useReorganize } from './useReorganize';

export function ReorganizePage() {
  const navigate = useNavigate();
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const { bins: allBins, isLoading } = useBinList(undefined, 'name');
  const { areas } = useAreaList(activeLocationId);
  const selection = useBinSelection(allBins);

  const [maxBins, setMaxBins] = useState<string>('');
  const [binsExpanded, setBinsExpanded] = useState(true);

  const {
    result,
    partialResult,
    isStreaming,
    error,
    applyError,
    isApplying,
    startReorg,
    apply,
    clear,
  } = useReorganize();

  // Derive area from selected bins (if all in same area)
  const selectedAreaId = useMemo(() => {
    if (selection.selectedBins.length === 0) return undefined;
    const first = selection.selectedBins[0].area_id;
    return selection.selectedBins.every((b) => b.area_id === first) ? first : undefined;
  }, [selection.selectedBins]);

  const selectedAreaName = useMemo(
    () => areas.find((a) => a.id === selectedAreaId)?.name,
    [areas, selectedAreaId],
  );

  const handleReorganize = useCallback(() => {
    if (selection.selectedBins.length < 2) return;
    const max = maxBins ? Number.parseInt(maxBins, 10) : undefined;
    startReorg(selection.selectedBins, max, selectedAreaId ?? undefined, selectedAreaName);
  }, [selection.selectedBins, maxBins, startReorg, selectedAreaId, selectedAreaName]);

  const handleAccept = useCallback(() => {
    apply(
      selection.selectedBins.map((b) => b.id),
      selectedAreaId ?? undefined,
    ).then(() => {
      navigate('/bins');
    });
  }, [apply, selection.selectedBins, selectedAreaId, navigate]);

  const hasProposal = result || partialResult.bins.length > 0;
  const itemCount = selection.selectedBins.reduce((sum, b) => sum + b.items.length, 0);

  if (isLoading) {
    return (
      <div className="page-content max-w-6xl">
        <PageHeader title="Reorganize" back />
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start gap-4">
          <div className="flex flex-col gap-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent>
                  <div className="row">
                    <Skeleton className="h-4 w-4 rounded shrink-0" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="hidden lg:block">
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content max-w-6xl">
      <PageHeader title="Reorganize" back />

      <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start gap-4">
        {/* Left column — settings */}
        <div className="flex flex-col gap-4">
          <BinSelectorCard
            allBins={allBins}
            areas={areas}
            selectedIds={selection.selectedIds}
            toggleBin={selection.toggleBin}
            selectAll={selection.selectAll}
            selectNone={selection.selectNone}
            selectByArea={selection.selectByArea}
            expanded={binsExpanded}
            onExpandedChange={setBinsExpanded}
          />

          <Card>
            <CardContent className="stack-3">
              <label className="stack-1">
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  Max {t.bins} (optional)
                </span>
                <input
                  type="number"
                  min={1}
                  value={maxBins}
                  onChange={(e) => setMaxBins(e.target.value)}
                  placeholder="AI decides"
                  className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                />
              </label>

              <div className="text-xs text-[var(--text-tertiary)]">
                {selection.selectedIds.size} {selection.selectedIds.size === 1 ? t.bin : t.bins} selected · {itemCount} item{itemCount !== 1 ? 's' : ''}
              </div>

              <Button
                onClick={handleReorganize}
                disabled={selection.selectedIds.size < 2 || isStreaming}
                fullWidth
              >
                <Sparkles className="icon-4 mr-2" />
                Reorganize {selection.selectedIds.size} {selection.selectedIds.size === 1 ? t.bin : t.bins}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right column — preview (sticky on desktop) */}
        <div className="lg:sticky lg:top-6 flex flex-col gap-4">
          {(error || applyError) && (
            <div className="rounded-lg bg-[var(--destructive-bg)] p-3 text-sm text-[var(--destructive)]">
              {error || applyError}
            </div>
          )}

          {(hasProposal || isStreaming) ? (
            <Card>
              <CardContent>
                <ReorganizePreview
                  result={result}
                  partialResult={partialResult}
                  isStreaming={isStreaming}
                  isApplying={isApplying}
                  originalCount={selection.selectedIds.size}
                  onAccept={handleAccept}
                  onCancel={clear}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <Sparkles className="icon-5 text-[var(--text-tertiary)]" />
                <p className="text-[15px] font-medium text-[var(--text-secondary)]">
                  No proposal yet
                </p>
                <p className="text-[13px] text-[var(--text-tertiary)] max-w-xs">
                  Select at least 2 {t.bins} and click Reorganize to let AI suggest a better organization.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
